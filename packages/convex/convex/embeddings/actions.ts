"use node";

import { v } from "convex/values";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { extractPlainText } from "./textExtractor";
import { chunkText } from "./chunker";
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./config";
import {
  getIndexableContentSource,
  INDEXABLE_CONTENT_SOURCES,
} from "../content/sourceRegistry";
import {
  buildEmbeddingUserSourceKey,
  embeddingSourceTableValidator,
} from "./schema";
import { type JSONContent } from "./textExtractor";

export const generateEmbedding = internalAction({
  args: {
    sourceTable: embeddingSourceTableValidator,
    sourceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { sourceTable, sourceId }) => {
    const source = getIndexableContentSource(sourceTable);

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

      // The published-status gate is metadata-driven: prose document sources
      // have a draft/published lifecycle, while structured bio entries are
      // always indexable. A future source must declare its lifecycle in the
      // registry before it can reach this action.
      if (
        source.embedding.lifecycle === "draft-published" &&
        content.kind === "doc" &&
        content.status !== "published"
      ) {
        await ctx.runMutation(internal.embeddings.mutations.deleteBySource, {
          sourceTable,
          sourceId,
        });
        return null;
      }

      // Build the chunked text according to the registry serializer. Document
      // sources run through TipTap-aware extraction + the chunker. Bio entries
      // are already short serialized prose and stay as a single chunk.
      let chunks: string[];
      let title: string;
      let userId;
      let slug: string | undefined;

      if (source.embedding.serializer === "bio" && content.kind === "bio") {
        chunks = [content.body];
        title = content.title;
        userId = content.userId;
        slug = undefined;
      } else if (
        source.embedding.serializer === "contact" &&
        content.kind === "contact"
      ) {
        // Contact entries are a single short label-value line; bypass the
        // chunker (same path bio takes) and store one row with no slug.
        chunks = [content.body];
        title = content.title;
        userId = content.userId;
        slug = undefined;
      } else if (
        source.embedding.serializer === "document" &&
        content.kind === "doc"
      ) {
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
      } else {
        throw new Error(
          `Embedding serializer mismatch for ${source.sourceTable}: registry declares ${source.embedding.serializer}, query returned ${content.kind}.`,
        );
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
          userSourceKey: buildEmbeddingUserSourceKey(userId, sourceTable),
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
    const sourceIdsByTable = await Promise.all(
      INDEXABLE_CONTENT_SOURCES.map(async (source) => ({
        sourceTable: source.sourceTable,
        ids: await ctx.runQuery(
          internal.embeddings.queries.listPublishedContent,
          { sourceTable: source.sourceTable },
        ),
      })),
    );

    // Fan out to independent scheduled actions to avoid timeout
    for (const { sourceTable, ids } of sourceIdsByTable) {
      for (const id of ids) {
        await ctx.scheduler.runAfter(
          0,
          internal.embeddings.actions.generateEmbedding,
          { sourceTable, sourceId: id },
        );
      }
    }

    return null;
  },
});
