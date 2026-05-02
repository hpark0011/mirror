import { defineTable } from "convex/server";
import { v } from "convex/values";
import { EMBEDDING_DIMENSIONS } from "./config";

/**
 * Single source of truth for the `sourceTable` literal union used across
 * `contentEmbeddings`, `generateEmbedding` args, `getContentForEmbedding`,
 * `listPublishedContent`, `deleteBySource`, and `insertChunks`.
 *
 * Adding a new RAG ingestion source means appending one literal here and
 * branching the (a) `getContentForEmbedding` discriminated-union return and
 * (b) `generateEmbedding` body — six call sites that used to need editing
 * are now reduced to three.
 *
 * INVARIANT (cross-user isolation): every consumer that writes to
 * `contentEmbeddings` MUST set `userId` from a server-derived value via
 * `getAppUser(ctx, ctx.user._id)` — never from a client-supplied argument.
 * The `by_embedding` vector index's `userId` filter is the sole barrier
 * preventing cross-user retrieval leakage.
 */
export const embeddingSourceTableValidator = v.union(
  v.literal("articles"),
  v.literal("posts"),
  v.literal("bioEntries"),
);

export const contentEmbeddingsTable = defineTable({
  sourceTable: embeddingSourceTableValidator,
  sourceId: v.string(),
  userId: v.id("users"),
  chunkIndex: v.number(),
  chunkText: v.string(),
  title: v.string(),
  // Optional: bio entries have no canonical URL, so this is `undefined` for
  // them. Storing `""` as a sentinel was rejected because it would pollute
  // any consumer that uses `slug` to construct a backlink. Existing string
  // slugs continue to satisfy the optional validator.
  slug: v.optional(v.string()),
  embedding: v.array(v.float64()),
  embeddingModel: v.string(),
  embeddedAt: v.number(),
})
  .index("by_sourceTable_and_sourceId", ["sourceTable", "sourceId"])
  .index("by_userId", ["userId"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: EMBEDDING_DIMENSIONS,
    filterFields: ["userId"],
  });
