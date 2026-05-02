"use node";

import { v } from "convex/values";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { extractPlainText } from "./textExtractor";
import { chunkText } from "./chunker";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./config";
import { embeddingSourceTableValidator } from "./schema";
import { type JSONContent } from "./textExtractor";

export const generateEmbedding = internalAction({
  args: {
    sourceTable: embeddingSourceTableValidator,
    sourceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { sourceTable, sourceId }) => {
    try {
      const content = await ctx.runQuery(
        internal.embeddings.queries.getContentForEmbedding,
        { sourceTable, sourceId },
      );

      // Source row deleted between schedule and execution — clean up any
      // stale embeddings.
      if (!content) {
        await ctx.runMutation(internal.embeddings.mutations.deleteBySource, {
          sourceTable,
          sourceId,
        });
        return null;
      }

      // Discriminate on kind (NOT on a sentinel `status: "published"` value).
      // The published-status gate is conceptually about prose docs that have a
      // draft/published lifecycle — bio entries don't, so we never trip the
      // gate on them. A future real `status` field on bio would not silently
      // bypass the gate because the discriminator is `kind`, not absence of
      // a field.
      if (content.kind === "doc" && content.status !== "published") {
        await ctx.runMutation(internal.embeddings.mutations.deleteBySource, {
          sourceTable,
          sourceId,
        });
        return null;
      }

      // Build the chunked text. `kind: "doc"` runs through TipTap-aware
      // extraction + the paragraph/sentence chunker. `kind: "bio"` is
      // already a short, pre-serialized prose blob and should NOT be fed
      // through `extractPlainText` (would crash walking `.content[]` on a
      // string) nor through `chunkText` (single chunk per entry is correct
      // and keeps RAG retrieval tight).
      let chunks: string[];
      let title: string;
      let userId;
      let slug: string | undefined;

      if (content.kind === "bio") {
        chunks = [content.body];
        title = content.title;
        userId = content.userId;
        slug = undefined;
      } else {
        const bodyText = content.body
          ? extractPlainText(content.body as JSONContent).trim()
          : "";
        const fullText = bodyText
          ? `# ${content.title}\n\n${bodyText}`
          : `# ${content.title}`;
        chunks = chunkText(fullText);
        title = content.title;
        userId = content.userId;
        slug = content.slug;
      }

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
          userId,
          chunkIndex: i,
          chunkText: chunks[i]!,
          title,
          slug,
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
    // Fetch all published articles and posts, plus all bio entries.
    const articles = await ctx.runQuery(
      internal.embeddings.queries.listPublishedContent,
      { sourceTable: "articles" },
    );
    const posts = await ctx.runQuery(
      internal.embeddings.queries.listPublishedContent,
      { sourceTable: "posts" },
    );
    const bioEntries = await ctx.runQuery(
      internal.embeddings.queries.listPublishedContent,
      { sourceTable: "bioEntries" },
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
    for (const id of bioEntries) {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "bioEntries", sourceId: id },
      );
    }

    return null;
  },
});
