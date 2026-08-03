import { ConvexError, v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { mutation, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { authComponent } from "../auth/client";
import { chatRateLimiter } from "./rateLimits";
import {
  chatModeValidator,
  isLegacyConfigurationConversation,
} from "./mode";

const MAX_MESSAGE_LENGTH = 3000;
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
  | "sendMessageDailyAuth";

type LimitCode = "RATE_LIMIT_MINUTE" | "RATE_LIMIT_DAILY";

async function enforceLimit(
  ctx: Parameters<typeof chatRateLimiter.limit>[0],
  name: LimitName,
  key: string,
  code: LimitCode,
): Promise<void> {
  const result = await chatRateLimiter.limit(ctx, name, {
    key,
    throws: false,
  });
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
    // Release A rollout compatibility for already-loaded clients.
    // Remove this argument after the Release B gate has been met.
    mode: v.optional(chatModeValidator),
    content: v.string(),
  },
  returns: v.object({ conversationId: v.id("conversations") }),
  handler: async (ctx, args) => {
    if (args.mode === "configuration") {
      throw new Error("Configuration chat is no longer available");
    }

    const messageText = args.content.trim();
    if (messageText.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (messageText.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message exceeds ${MAX_MESSAGE_LENGTH} character limit`);
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    const appUser = authUser
      ? await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
          .unique()
      : null;

    const profileOwner = await ctx.db.get(args.profileOwnerId);
    if (!profileOwner) {
      throw new Error("Profile owner not found");
    }

    let conversationId = args.conversationId;
    if (conversationId) {
      const existingConversation = await ctx.db.get(conversationId);
      if (!existingConversation) {
        throw new Error("Conversation not found");
      }
      if (isLegacyConfigurationConversation(existingConversation)) {
        throw new Error("Conversation not found");
      }
      if (existingConversation.profileOwnerId !== args.profileOwnerId) {
        throw new Error("Conversation does not belong to this profile");
      }
      if (appUser) {
        if (existingConversation.viewerId !== appUser._id) {
          throw new Error("Not authorized to send to this conversation");
        }
      } else if (existingConversation.viewerId !== undefined) {
        throw new Error("Not authorized to send to this conversation");
      }
      if (isStreamingLockHeld(existingConversation)) {
        throw new Error(
          "A response is already being generated. Please wait for it to complete.",
        );
      }

      await enforceLimit(
        ctx,
        "sendMessage",
        appUser ? appUser._id : conversationId,
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

    await enforceLimit(
      ctx,
      appUser ? "sendMessageDailyAuth" : "sendMessageDailyAnon",
      appUser ? appUser._id : args.profileOwnerId,
      "RATE_LIMIT_DAILY",
    );

    if (!conversationId) {
      const threadId = await createThread(ctx, components.agent, {
        userId: appUser?._id,
      });
      conversationId = await ctx.db.insert("conversations", {
        profileOwnerId: args.profileOwnerId,
        viewerId: appUser?._id,
        threadId,
        status: "active",
        title: messageText.slice(0, 100),
      });
    }

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || isLegacyConfigurationConversation(conversation)) {
      throw new Error("Conversation not found");
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      message: {
        role: "user",
        content: [{ type: "text", text: messageText }],
      },
      userId: appUser?._id,
    });

    const lockStartedAt = Date.now();
    await ctx.db.patch(conversationId, {
      streamingInProgress: true,
      streamingStartedAt: lockStartedAt,
    });
    await ctx.scheduler.runAfter(0, internal.chat.actions.streamResponse, {
      conversationId,
      profileOwnerId: args.profileOwnerId,
      promptMessageId: messageId,
      lockStartedAt,
      userMessage: messageText,
    });

    return { conversationId };
  },
});

export const retryMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    // Release A rollout compatibility for already-loaded clients.
    // Remove this argument after the Release B gate has been met.
    mode: v.optional(chatModeValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.mode === "configuration") {
      throw new Error("Configuration chat is no longer available");
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    const appUser = authUser
      ? await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
          .unique()
      : null;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || isLegacyConfigurationConversation(conversation)) {
      throw new Error("Conversation not found");
    }

    if (appUser) {
      if (conversation.viewerId !== appUser._id) {
        throw new Error("Not authorized to retry in this conversation");
      }
    } else if (conversation.viewerId !== undefined) {
      throw new Error("Not authorized to retry in this conversation");
    }

    if (isStreamingLockHeld(conversation)) {
      throw new Error(
        "A response is already being generated. Please wait for it to complete.",
      );
    }

    await enforceLimit(
      ctx,
      "retryMessage",
      appUser ? appUser._id : conversation.profileOwnerId,
      "RATE_LIMIT_MINUTE",
    );
    await enforceLimit(
      ctx,
      appUser ? "sendMessageDailyAuth" : "sendMessageDailyAnon",
      appUser ? appUser._id : conversation.profileOwnerId,
      "RATE_LIMIT_DAILY",
    );

    const lockStartedAt = Date.now();
    await ctx.db.patch(args.conversationId, {
      streamingInProgress: true,
      streamingStartedAt: lockStartedAt,
    });
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
