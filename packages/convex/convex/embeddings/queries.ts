import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";

type EmbeddableDoc = Doc<"articles"> | Doc<"posts">;

export const listPublishedContent = internalQuery({
  args: {
    sourceTable: v.union(v.literal("articles"), v.literal("posts")),
  },
  returns: v.array(v.string()),
  handler: async (ctx, { sourceTable }) => {
    const docs = await ctx.db.query(sourceTable).collect();
    return docs
      .filter((d) => (d as EmbeddableDoc).status === "published")
      .map((d) => d._id as string);
  },
});

export const getContentForEmbedding = internalQuery({
  args: {
    sourceTable: v.union(v.literal("articles"), v.literal("posts")),
    sourceId: v.string(),
  },
  returns: v.union(
    v.object({
      title: v.string(),
      body: v.any(),
      slug: v.string(),
      userId: v.id("users"),
      status: v.union(v.literal("draft"), v.literal("published")),
    }),
    v.null(),
  ),
  handler: async (ctx, { sourceTable, sourceId }) => {
    // Query the correct table to ensure type safety
    const doc = sourceTable === "articles"
      ? await ctx.db.get(sourceId as Id<"articles">)
      : await ctx.db.get(sourceId as Id<"posts">);
    if (!doc) return null;

    const record = doc as EmbeddableDoc;

    return {
      title: record.title,
      body: record.body,
      slug: record.slug,
      userId: record.userId,
      status: record.status,
    };
  },
});

export const fetchChunksByIds = internalQuery({
  args: {
    ids: v.array(v.id("contentEmbeddings")),
  },
  returns: v.array(
    v.object({
      title: v.string(),
      slug: v.string(),
      chunkText: v.string(),
    }),
  ),
  handler: async (ctx, { ids }) => {
    const chunks = await Promise.all(
      ids.map(async (id) => {
        const doc = await ctx.db.get(id);
        if (!doc) return null;
        return {
          title: doc.title,
          slug: doc.slug,
          chunkText: doc.chunkText,
        };
      }),
    );

    return chunks.filter(
      (c): c is NonNullable<typeof c> => c !== null,
    );
  },
});
