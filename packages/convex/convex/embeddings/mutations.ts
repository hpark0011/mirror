import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { embeddingSourceTableValidator } from "./schema";

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
