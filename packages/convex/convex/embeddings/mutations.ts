import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const deleteBySource = internalMutation({
  args: {
    sourceTable: v.union(v.literal("articles"), v.literal("posts")),
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
        sourceTable: v.union(v.literal("articles"), v.literal("posts")),
        sourceId: v.string(),
        userId: v.id("users"),
        chunkIndex: v.number(),
        chunkText: v.string(),
        title: v.string(),
        slug: v.string(),
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
