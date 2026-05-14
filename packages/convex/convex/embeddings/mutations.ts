import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { embeddingSourceTableValidator } from "./schema";

/**
 * Atomically replaces all embedding rows for a given source in a single
 * transaction. This eliminates the delete-then-insert race window that exists
 * when two concurrent `generateEmbedding` jobs for the same `sourceId` run
 * back-to-back across two separate mutations:
 *
 *   Concurrent bug:  A.delete → B.delete → A.insert → B.insert  (duplicates)
 *   Fixed:           A.replaceChunks (atomic) || B.replaceChunks (atomic)
 *                    → last writer wins, no duplicates
 *
 * Preserve `deleteBySource` for the unpublish/delete cleanup path that
 * deliberately removes rows without inserting replacements.
 */
export const replaceChunksForSource = internalMutation({
  args: {
    sourceTable: embeddingSourceTableValidator,
    sourceId: v.string(),
    chunks: v.array(
      v.object({
        sourceTable: embeddingSourceTableValidator,
        sourceId: v.string(),
        userId: v.id("users"),
        userSourceKey: v.string(),
        chunkIndex: v.number(),
        chunkText: v.string(),
        title: v.string(),
        slug: v.optional(v.string()),
        embedding: v.array(v.float64()),
        embeddingModel: v.string(),
        embeddedAt: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { sourceTable, sourceId, chunks }) => {
    // Delete existing rows first — same logic as deleteBySource.
    const existing = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_sourceTable_and_sourceId", (q) =>
        q.eq("sourceTable", sourceTable).eq("sourceId", sourceId),
      )
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    // Insert the new chunks in the same transaction.
    for (const chunk of chunks) {
      await ctx.db.insert("contentEmbeddings", chunk);
    }

    return null;
  },
});

export const deleteBySource = internalMutation({
  args: {
    sourceTable: embeddingSourceTableValidator,
    sourceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { sourceTable, sourceId }) => {
    const existing = await ctx.db
      .query("contentEmbeddings")
      .withIndex("by_sourceTable_and_sourceId", (q) =>
        q.eq("sourceTable", sourceTable).eq("sourceId", sourceId),
      )
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    return null;
  },
});

export const insertChunks = internalMutation({
  args: {
    chunks: v.array(
      v.object({
        sourceTable: embeddingSourceTableValidator,
        sourceId: v.string(),
        userId: v.id("users"),
        userSourceKey: v.string(),
        chunkIndex: v.number(),
        chunkText: v.string(),
        title: v.string(),
        // Optional: bio chunks have no canonical URL.
        slug: v.optional(v.string()),
        embedding: v.array(v.float64()),
        embeddingModel: v.string(),
        embeddedAt: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { chunks }) => {
    for (const chunk of chunks) {
      await ctx.db.insert("contentEmbeddings", chunk);
    }
    return null;
  },
});
