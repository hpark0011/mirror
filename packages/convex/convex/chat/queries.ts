import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { listUIMessages, syncStreams, vStreamArgs } from "@convex-dev/agent";
import { query, internalQuery } from "../_generated/server";
import { components } from "../_generated/api";
import { authComponent } from "../auth/client";
import { type Doc } from "../_generated/dataModel";
import {
  chatModeValidator,
  isLegacyConfigurationConversation,
} from "./mode";

const conversationReturnValidator = v.object({
  _id: v.id("conversations"),
  _creationTime: v.number(),
  profileOwnerId: v.id("users"),
  viewerId: v.optional(v.id("users")),
  threadId: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  title: v.string(),
  streamingInProgress: v.optional(v.boolean()),
});

function toConversationData(conversation: Doc<"conversations">) {
  return {
    _id: conversation._id,
    _creationTime: conversation._creationTime,
    profileOwnerId: conversation.profileOwnerId,
    viewerId: conversation.viewerId,
    threadId: conversation.threadId,
    status: conversation.status,
    title: conversation.title,
    streamingInProgress: conversation.streamingInProgress,
  };
}

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  returns: v.union(conversationReturnValidator, v.null()),
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || isLegacyConfigurationConversation(conversation)) {
      return null;
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    const appUser = authUser
      ? await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
          .unique()
      : null;
    const conversationData = toConversationData(conversation);

    if (appUser && appUser._id === conversation.profileOwnerId) {
      return conversationData;
    }
    if (appUser && conversation.viewerId === appUser._id) {
      return conversationData;
    }
    if (!appUser && conversation.viewerId === undefined) {
      return conversationData;
    }
    return null;
  },
});

export const getConversations = query({
  args: {
    profileOwnerId: v.id("users"),
    // Release A rollout compatibility for already-loaded clients.
    // Remove this argument after the Release B gate has been met.
    mode: v.optional(chatModeValidator),
  },
  returns: v.array(conversationReturnValidator),
  handler: async (ctx, { profileOwnerId, mode }) => {
    if (mode === "configuration") return [];

    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser) return [];

    const appUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .unique();
    if (!appUser) return [];

    const conversations =
      appUser._id === profileOwnerId
        ? await ctx.db
            .query("conversations")
            .withIndex("by_profileOwnerId_and_viewerId", (q) =>
              q.eq("profileOwnerId", profileOwnerId),
            )
            .order("desc")
            .collect()
        : await ctx.db
            .query("conversations")
            .withIndex("by_profileOwnerId_and_viewerId", (q) =>
              q
                .eq("profileOwnerId", profileOwnerId)
                .eq("viewerId", appUser._id),
            )
            .order("desc")
            .collect();

    return conversations
      .filter(
        (conversation) => !isLegacyConfigurationConversation(conversation),
      )
      .map(toConversationData);
  },
});

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
  },
  returns: v.any(),
  handler: async (ctx, { conversationId, paginationOpts, streamArgs }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || isLegacyConfigurationConversation(conversation)) {
      return null;
    }

    const authUser = await authComponent.safeGetAuthUser(ctx);
    const appUser = authUser
      ? await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
          .unique()
      : null;

    const isOwner = appUser?._id === conversation.profileOwnerId;
    const isViewer = appUser?._id === conversation.viewerId;
    const isAnonymousConversation =
      !appUser && conversation.viewerId === undefined;
    if (!isOwner && !isViewer && !isAnonymousConversation) {
      return null;
    }

    const messages = await listUIMessages(ctx, components.agent, {
      threadId: conversation.threadId,
      paginationOpts,
    });
    const streams = streamArgs
      ? await syncStreams(ctx, components.agent, {
          threadId: conversation.threadId,
          streamArgs,
        })
      : undefined;
    return { ...messages, streams };
  },
});

export const internalGetConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  returns: v.union(
    v.object({
      ...conversationReturnValidator.fields,
      streamingStartedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || isLegacyConfigurationConversation(conversation)) {
      return null;
    }
    return {
      ...toConversationData(conversation),
      streamingStartedAt: conversation.streamingStartedAt,
    };
  },
});
