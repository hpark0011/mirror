import { v } from "convex/values";
import { createThread, saveMessage } from "@convex-dev/agent";
import { mutation, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { authComponent } from "../auth/client";
import { chatRateLimiter } from "./rateLimits";

const MAX_MESSAGE_LENGTH = 4000;

export const sendMessage = mutation({
  args: {
    profileOwnerId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    content: v.string(),
  },
  returns: v.object({ conversationId: v.id("conversations") }),
  handler: async (ctx, args) => {
    // 1. Input validation
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
    if (conversationId) {
      const conversation = await ctx.db.get(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }
      if (conversation.profileOwnerId !== args.profileOwnerId) {
        throw new Error("Conversation does not belong to this profile");
      }
      // Viewer must match
      if (appUser) {
        if (conversation.viewerId !== appUser._id) {
          throw new Error("Not authorized to send to this conversation");
        }
      } else {
        if (conversation.viewerId !== undefined) {
          throw new Error("Not authorized to send to this conversation");
        }
      }

      // 5. Rate limit (existing conversation)
      await chatRateLimiter.limit(ctx, "sendMessage", {
        key: appUser ? appUser._id : conversationId,
        throws: true,
      });

      // 6. Concurrency guard
      if (conversation.streamingInProgress) {
        throw new Error(
          "A response is already being generated. Please wait for it to complete.",
        );
      }
    } else {
      // 5. Rate limit (new conversation)
      await chatRateLimiter.limit(ctx, "createConversation", {
        key: appUser ? appUser._id : args.profileOwnerId,
        throws: true,
      });
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

    // 2. Rate limit
    await chatRateLimiter.limit(ctx, "retryMessage", {
      key: appUser ? appUser._id : args.conversationId,
      throws: true,
    });

    // 3. Guard: reject if streaming already in progress
    if (conversation.streamingInProgress) {
      throw new Error(
        "A response is already being generated. Please wait for it to complete.",
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
