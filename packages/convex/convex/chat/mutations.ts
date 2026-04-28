import { ConvexError, v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { mutation, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { authComponent } from "../auth/client";
import { chatRateLimiter } from "./rateLimits";

const MAX_MESSAGE_LENGTH = 3000;

type LimitName =
  | "sendMessage"
  | "retryMessage"
  | "createConversation"
  | "sendMessageDailyAnon"
  | "sendMessageDailyAuth";

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
): Promise<void> {
  const result = await chatRateLimiter.limit(ctx, name, { key, throws: false });
  if (!result.ok) {
    throw new ConvexError({
      code,
      retryAfterMs: result.retryAfter,
    });
  }
}

export const sendMessage = mutation({
  args: {
    profileOwnerId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    content: v.string(),
  },
  returns: v.object({ conversationId: v.id("conversations") }),
  handler: async (ctx, args) => {
    // 1. Input validation — must precede any rate-limit work so oversize
    //    messages are rejected without consuming daily budget (FR-02).
    const content = args.content.trim();
    if (content.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} character limit`);
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
      // spending minute or daily budget.
      if (existingConversation.streamingInProgress) {
        throw new Error(
          "A response is already being generated. Please wait for it to complete.",
        );
      }

      // 5a. Per-minute burst limit (existing conversation).
      await enforceLimit(
        ctx,
        "sendMessage",
        appUser ? appUser._id : conversationId,
        "RATE_LIMIT_MINUTE",
      );
    } else {
      // 5a. Per-minute burst limit (new conversation path).
      await enforceLimit(
        ctx,
        "createConversation",
        appUser ? appUser._id : args.profileOwnerId,
        "RATE_LIMIT_MINUTE",
      );
    }

    // 5b. Daily spend ceiling (FR-03/FR-04/FR-06). Keyed by user (auth) or
    //     profileOwnerId (anon) in BOTH branches so new-conversation churn
    //     cannot bypass the daily cap. MUST run strictly before we patch
    //     streamingInProgress (NFR-03).
    if (appUser) {
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
        viewerId: appUser?._id,
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
    await ctx.scheduler.runAfter(
      0,
      internal.chat.actions.streamResponse,
      {
        conversationId,
        profileOwnerId: args.profileOwnerId,
        promptMessageId: messageId,
        lockStartedAt,
        userMessage: content,
      },
    );

    return { conversationId };
  },
});

export const retryMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
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

    // Concurrency guard runs BEFORE rate-limit so a retry against an
    // already-streaming conversation is rejected without spending budget.
    if (conversation.streamingInProgress) {
      throw new Error(
        "A response is already being generated. Please wait for it to complete.",
      );
    }

    // 2a. Per-minute burst limit. Re-keyed to profileOwnerId (anon) /
    //     appUser._id (auth) — matching sendMessage — so retries on a
    //     fresh conversation cannot bypass daily caps via key-switching
    //     (FR-05).
    await enforceLimit(
      ctx,
      "retryMessage",
      appUser ? appUser._id : conversation.profileOwnerId,
      "RATE_LIMIT_MINUTE",
    );

    // 2b. Daily spend ceiling (FR-03/FR-04).
    if (appUser) {
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
    await ctx.scheduler.runAfter(
      0,
      internal.chat.actions.streamResponse,
      {
        conversationId: args.conversationId,
        profileOwnerId: conversation.profileOwnerId,
        promptMessageId: "",
        lockStartedAt,
      },
    );

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
    if (
      conversation &&
      conversation.streamingStartedAt === expectedStartedAt
    ) {
      await ctx.db.patch(conversationId, {
        streamingInProgress: false,
        streamingStartedAt: undefined,
      });
    }
    return null;
  },
});

export const saveAssistantMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { conversationId, content }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      message: {
        role: "assistant",
        content: [{ type: "text", text: content }],
      },
    });

    return null;
  },
});
