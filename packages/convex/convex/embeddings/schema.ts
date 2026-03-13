import { defineTable } from "convex/server";
import { v } from "convex/values";
import { EMBEDDING_DIMENSIONS } from "./config";

export const contentEmbeddingsTable = defineTable({
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
})
  .index("by_sourceTable_and_sourceId", ["sourceTable", "sourceId"])
  .index("by_userId", ["userId"])
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: EMBEDDING_DIMENSIONS,
    filterFields: ["userId"],
  });
