import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import { cloneAgent } from "./agent";

export const getNext = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      conversationId: v.id("conversations"),
      threadId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_mode", (q) => q.eq("mode", "configuration"))
      .first();
    return conversation
      ? {
          conversationId: conversation._id,
          threadId: conversation.threadId,
        }
      : null;
  },
});

export const deleteLocalRow = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    expectedThreadId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { conversationId, expectedThreadId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return false;
    if (
      conversation.mode !== "configuration" ||
      conversation.threadId !== expectedThreadId
    ) {
      return false;
    }
    await ctx.db.delete(conversationId);
    return true;
  },
});

/**
 * Release A only. Deletes exactly one component thread before deleting its
 * local row, then schedules the next item. A component deletion failure throws
 * before the local mutation, leaving the row intact and retryable.
 */
export const cleanupNext = internalAction({
  args: {},
  returns: v.object({
    cleaned: v.boolean(),
    complete: v.boolean(),
  }),
  handler: async (ctx) => {
    const next: {
      conversationId: Id<"conversations">;
      threadId: string;
    } | null = await ctx.runQuery(
      internal.chat.legacyConfigurationCleanup.getNext,
      {},
    );
    if (!next) {
      return { cleaned: false, complete: true };
    }

    await cloneAgent.deleteThreadSync(ctx, { threadId: next.threadId });
    const deleted: boolean = await ctx.runMutation(
      internal.chat.legacyConfigurationCleanup.deleteLocalRow,
      {
        conversationId: next.conversationId,
        expectedThreadId: next.threadId,
      },
    );
    if (!deleted) {
      throw new Error("Legacy conversation changed during cleanup");
    }

    await ctx.scheduler.runAfter(
      0,
      internal.chat.legacyConfigurationCleanup.cleanupNext,
      {},
    );
    return { cleaned: true, complete: false };
  },
});

export const verify = internalQuery({
  args: {},
  returns: v.object({
    configurationRowsRemain: v.boolean(),
    cloneModeRowsRemain: v.boolean(),
  }),
  handler: async (ctx) => {
    const [configuration, clone] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_mode", (q) => q.eq("mode", "configuration"))
        .first(),
      ctx.db
        .query("conversations")
        .withIndex("by_mode", (q) => q.eq("mode", "clone"))
        .first(),
    ]);
    return {
      configurationRowsRemain: configuration !== null,
      cloneModeRowsRemain: clone !== null,
    };
  },
});
