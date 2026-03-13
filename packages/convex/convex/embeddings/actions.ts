"use node";

import { v } from "convex/values";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { extractPlainText } from "./textExtractor";
import { chunkText } from "./chunker";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./config";
import type { JSONContent } from "./textExtractor";

export const generateEmbedding = internalAction({
  args: {
    sourceTable: v.union(v.literal("articles"), v.literal("posts")),
    sourceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { sourceTable, sourceId }) => {
    try {
      const content = await ctx.runQuery(
        internal.embeddings.queries.getContentForEmbedding,
        { sourceTable, sourceId },
      );

      if (!content || content.status !== "published") {
        // Not published — clean up any existing embeddings
        await ctx.runMutation(internal.embeddings.mutations.deleteBySource, {
          sourceTable,
          sourceId,
        });
        return null;
      }

      const bodyText = content.body
        ? extractPlainText(content.body as JSONContent).trim()
        : "";
      const fullText = bodyText
        ? `# ${content.title}\n\n${bodyText}`
        : `# ${content.title}`;

      const chunks = chunkText(fullText);

      const { embeddings } = await embedMany({
        model: google.textEmbeddingModel(EMBEDDING_MODEL),
        values: chunks,
        providerOptions: {
          google: { outputDimensionality: EMBEDDING_DIMENSIONS },
        },
      });

      // Delete existing embeddings first
      await ctx.runMutation(internal.embeddings.mutations.deleteBySource, {
        sourceTable,
        sourceId,
      });

      // Insert new chunks
      const now = Date.now();
      await ctx.runMutation(internal.embeddings.mutations.insertChunks, {
        chunks: embeddings.map((embedding, i) => ({
          sourceTable,
          sourceId,
          userId: content.userId,
          chunkIndex: i,
          chunkText: chunks[i]!,
          title: content.title,
          slug: content.slug,
          embedding,
          embeddingModel: EMBEDDING_MODEL,
          embeddedAt: now,
        })),
      });
    } catch (error) {
      console.error(
        `Failed to generate embeddings for ${sourceTable}/${sourceId}:`,
        error,
      );
      throw error;
    }

    return null;
  },
});

export const backfillEmbeddings = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Fetch all published articles and posts
    const articles = await ctx.runQuery(
      internal.embeddings.queries.listPublishedContent,
      { sourceTable: "articles" },
    );
    const posts = await ctx.runQuery(
      internal.embeddings.queries.listPublishedContent,
      { sourceTable: "posts" },
    );

    // Fan out to independent scheduled actions to avoid timeout
    for (const id of articles) {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "articles", sourceId: id },
      );
    }
    for (const id of posts) {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "posts", sourceId: id },
      );
    }

    return null;
  },
});
