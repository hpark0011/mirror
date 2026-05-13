import { ConvexError, v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { mutation, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { authComponent } from "../auth/client";
import { chatRateLimiter } from "./rateLimits";
import {
  DEFAULT_CHAT_MODE,
  chatModeValidator,
  getConversationMode,
  type ChatMode,
} from "./mode";

const MAX_MESSAGE_LENGTH = 3000;
const MAX_CONFIGURATION_MESSAGE_LENGTH = 12000;

// A streaming-lock is treated as "held" only if it was acquired within the
// last STREAMING_LOCK_TTL_MS. Older locks are presumed crashed (the
// `streamResponse` action either finished and called `clearStreamingLock`
// or it died) and the next message acquires fresh. Replaces the prior
// 5-minute cron sweep — recovery now happens lazily at the only place
// that cares about lock state.
const STREAMING_LOCK_TTL_MS = 2 * 60 * 1000;

function isStreamingLockHeld(conversation: {
  streamingInProgress?: boolean;
  streamingStartedAt?: number;
}): boolean {
  if (!conversation.streamingInProgress) return false;
  if (conversation.streamingStartedAt === undefined) return false;
  return conversation.streamingStartedAt > Date.now() - STREAMING_LOCK_TTL_MS;
}

type LimitName =
  | "sendMessage"
  | "retryMessage"
  | "createConversation"
  | "sendMessageDailyAnon"
  | "sendMessageDailyAuth"
  | "createConfigurationConversation"
  | "sendConfigurationMessage"
  | "retryConfigurationMessage"
  | "sendConfigurationDailyOwner";

type LimitCode = "RATE_LIMIT_MINUTE" | "RATE_LIMIT_DAILY";

/**
 * Narrow wrapper around `chatRateLimiter.limit` that converts a rejection into
 * a structured `ConvexError` the frontend can discriminate on (per FR-07).
 *
 * `retryAfter` from `@convex-dev/rate-limiter` is already in milliseconds, so
 * we pass it through unchanged as `retryAfterMs`.
 *
 * Ordering note (Wave 1 Finding B verification, 2026-04-15): callers check
 * the per-minute bucket BEFORE the daily bucket. This is safe because
 * `@convex-dev/rate-limiter@0.3.2` does NOT consume a token on rejection —
 * `checkRateLimitSharded` in the component's `internal.ts` returns
 * `updates: []` when `!status.ok`, and the component's `rateLimit` mutation
 * in `lib.ts` only patches/inserts entries in `updates`. So a failed
 * per-minute check leaves ALL buckets untouched, and the downstream daily
 * check only runs when the per-minute check already passed. Swapping the
 * order would not improve correctness; the reviewer's concern was a false
 * positive after source verification.
 */
async function enforceLimit(
  // The rate limiter accepts any query/mutation/action context. Using a loose
  // type here avoids fighting the generic component-client parameter type.
  ctx: Parameters<typeof chatRateLimiter.limit>[0],
  name: LimitName,
  key: string,
  code: LimitCode,
  count?: number,
): Promise<void> {
  const result = await chatRateLimiter.limit(ctx, name, {
    key,
    throws: false,
    ...(count !== undefined ? { count } : {}),
  });
  if (!result.ok) {
    throw new ConvexError({
      code,
      retryAfterMs: result.retryAfter,
    });
  }
}

function estimateInputTokenCount(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function getMaxMessageLength(mode: ChatMode): number {
  return mode === "configuration"
    ? MAX_CONFIGURATION_MESSAGE_LENGTH
    : MAX_MESSAGE_LENGTH;
}

export const sendMessage = mutation({
  args: {
    profileOwnerId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    mode: v.optional(chatModeValidator),
    content: v.string(),
  },
  returns: v.object({ conversationId: v.id("conversations") }),
  handler: async (ctx, args) => {
    const mode = args.mode ?? DEFAULT_CHAT_MODE;

    // 1. Input validation — must precede any rate-limit work so oversize
    //    messages are rejected without consuming daily budget (FR-02).
    const content = args.content.trim();
    if (content.length === 0) {
      throw new Error("Message cannot be empty");
    }
    const maxMessageLength = getMaxMessageLength(mode);
    if (content.length > maxMessageLength) {
      throw new Error(`Message exceeds ${maxMessageLength} character limit`);
    }

    // 2. Optional auth
    const authUser = await authComponent.safeGetAuthUser(ctx);
    let appUser = null;
    if (authUser) {
      appUser = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
        .unique();
    }

    // 3. Profile owner validation
    const profileOwner = await ctx.db.get(args.profileOwnerId);
    if (!profileOwner) {
      throw new Error("Profile owner not found");
    }
    if (profileOwner.chatAuthRequired && !appUser) {
      throw new Error("Authentication required to chat with this profile");
    }

    if (mode === "configuration") {
      if (!appUser) {
        throw new Error("Authentication required to configure this profile");
      }
      if (appUser._id !== args.profileOwnerId) {
        throw new Error("Only the profile owner can configure this profile");
      }
    }

    // 4. Existing conversation ownership validation
    let conversationId = args.conversationId;
    let existingConversation = null;
    if (conversationId) {
      existingConversation = await ctx.db.get(conversationId);
      if (!existingConversation) {
        throw new Error("Conversation not found");
      }
      if (existingConversation.profileOwnerId !== args.profileOwnerId) {
        throw new Error("Conversation does not belong to this profile");
      }
      const existingMode = getConversationMode(existingConversation);
      if (existingMode !== mode) {
        throw new Error("Conversation mode mismatch");
      }
      // Viewer must match
      if (appUser) {
        if (existingConversation.viewerId !== appUser._id) {
          throw new Error("Not authorized to send to this conversation");
        }
      } else {
        if (existingConversation.viewerId !== undefined) {
          throw new Error("Not authorized to send to this conversation");
        }
      }

      // Concurrency guard runs BEFORE rate-limit so a double-click / retry
      // against an already-streaming conversation is rejected without
      // spending minute or daily budget. A stale lock (older than the TTL)
      // is treated as released — see `isStreamingLockHeld`.
      if (isStreamingLockHeld(existingConversation)) {
        throw new Error(
          "A response is already being generated. Please wait for it to complete.",
        );
      }

      // 5a. Per-minute burst limit (existing conversation).
      if (mode === "configuration") {
        await enforceLimit(
          ctx,
          "sendConfigurationMessage",
          appUser!._id,
          "RATE_LIMIT_MINUTE",
        );
      } else {
        await enforceLimit(
          ctx,
          "sendMessage",
          appUser ? appUser._id : conversationId,
          "RATE_LIMIT_MINUTE",
        );
      }
    } else {
      // 5a. Per-minute burst limit (new conversation path).
      if (mode === "configuration") {
        await enforceLimit(
          ctx,
          "createConfigurationConversation",
          appUser!._id,
          "RATE_LIMIT_MINUTE",
        );
      } else {
        await enforceLimit(
          ctx,
          "createConversation",
          appUser ? appUser._id : args.profileOwnerId,
          "RATE_LIMIT_MINUTE",
        );
      }
    }

    // 5b. Daily spend ceiling (FR-03/FR-04/FR-06). Keyed by user (auth) or
    //     profileOwnerId (anon) in BOTH branches so new-conversation churn
    //     cannot bypass the daily cap. MUST run strictly before we patch
    //     streamingInProgress (NFR-03).
    if (mode === "configuration") {
      await enforceLimit(
        ctx,
        "sendConfigurationDailyOwner",
        appUser!._id,
        "RATE_LIMIT_DAILY",
        estimateInputTokenCount(content),
      );
    } else if (appUser) {
      await enforceLimit(
        ctx,
        "sendMessageDailyAuth",
        appUser._id,
        "RATE_LIMIT_DAILY",
      );
    } else {
      await enforceLimit(
        ctx,
        "sendMessageDailyAnon",
        args.profileOwnerId,
        "RATE_LIMIT_DAILY",
      );
    }

    // 7. Create conversation + thread if first message
    if (!conversationId) {
      const threadId = await createThread(ctx, components.agent, {
        userId: appUser?._id,
      });

      conversationId = await ctx.db.insert("conversations", {
        profileOwnerId: args.profileOwnerId,
        viewerId: mode === "configuration" ? args.profileOwnerId : appUser?._id,
        mode,
        threadId,
        status: "active",
        title: content.slice(0, 100),
      });
    }

    // Refetch for threadId (needed for saveMessage)
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    // 8. Save user message
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      prompt: content,
      userId: appUser?._id,
    });

    // 9. Set streaming lock
    const lockStartedAt = Date.now();
    await ctx.db.patch(conversationId, {
      streamingInProgress: true,
      streamingStartedAt: lockStartedAt,
    });

    // 10. Schedule action
    await ctx.scheduler.runAfter(0, internal.chat.actions.streamResponse, {
      conversationId,
      profileOwnerId: args.profileOwnerId,
      promptMessageId: messageId,
      lockStartedAt,
      userMessage: content,
    });

    return { conversationId };
  },
});

export const retryMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    mode: v.optional(chatModeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const requestedMode = args.mode ?? DEFAULT_CHAT_MODE;

    // 1. Auth + ownership check
    const authUser = await authComponent.safeGetAuthUser(ctx);
    let appUser = null;
    if (authUser) {
      appUser = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
        .unique();
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    const conversationMode = getConversationMode(conversation);
    if (conversationMode !== requestedMode) {
      throw new Error("Conversation mode mismatch");
    }

    // Viewer must match
    if (appUser) {
      if (conversation.viewerId !== appUser._id) {
        throw new Error("Not authorized to retry in this conversation");
      }
    } else {
      if (conversation.viewerId !== undefined) {
        throw new Error("Not authorized to retry in this conversation");
      }
    }

    if (conversationMode === "configuration") {
      if (!appUser || appUser._id !== conversation.profileOwnerId) {
        throw new Error("Only the profile owner can configure this profile");
      }
    }

    // Concurrency guard runs BEFORE rate-limit so a retry against an
    // already-streaming conversation is rejected without spending budget.
    // A stale lock (older than the TTL) is treated as released — see
    // `isStreamingLockHeld`.
    if (isStreamingLockHeld(conversation)) {
      throw new Error(
        "A response is already being generated. Please wait for it to complete.",
      );
    }

    // 2a. Per-minute burst limit. Re-keyed to profileOwnerId (anon) /
    //     appUser._id (auth) — matching sendMessage — so retries on a
    //     fresh conversation cannot bypass daily caps via key-switching
    //     (FR-05).
    if (conversationMode === "configuration") {
      await enforceLimit(
        ctx,
        "retryConfigurationMessage",
        appUser!._id,
        "RATE_LIMIT_MINUTE",
      );
    } else {
      await enforceLimit(
        ctx,
        "retryMessage",
        appUser ? appUser._id : conversation.profileOwnerId,
        "RATE_LIMIT_MINUTE",
      );
    }

    // 2b. Daily spend ceiling (FR-03/FR-04).
    if (conversationMode === "configuration") {
      await enforceLimit(
        ctx,
        "sendConfigurationDailyOwner",
        appUser!._id,
        "RATE_LIMIT_DAILY",
        1,
      );
    } else if (appUser) {
      await enforceLimit(
        ctx,
        "sendMessageDailyAuth",
        appUser._id,
        "RATE_LIMIT_DAILY",
      );
    } else {
      await enforceLimit(
        ctx,
        "sendMessageDailyAnon",
        conversation.profileOwnerId,
        "RATE_LIMIT_DAILY",
      );
    }

    // 4. Set streaming lock
    const lockStartedAt = Date.now();
    await ctx.db.patch(args.conversationId, {
      streamingInProgress: true,
      streamingStartedAt: lockStartedAt,
    });

    // 5. Schedule streamResponse with empty promptMessageId (retry signal)
    await ctx.scheduler.runAfter(0, internal.chat.actions.streamResponse, {
      conversationId: args.conversationId,
      profileOwnerId: conversation.profileOwnerId,
      promptMessageId: "",
      lockStartedAt,
    });

    return null;
  },
});

export const clearStreamingLock = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    expectedStartedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, expectedStartedAt }) => {
    const conversation = await ctx.db.get(conversationId);
    if (conversation && conversation.streamingStartedAt === expectedStartedAt) {
      await ctx.db.patch(conversationId, {
        streamingInProgress: false,
        streamingStartedAt: undefined,
      });
    }
    return null;
  },
});
