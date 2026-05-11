"use node";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../embeddings/config";
import { buildEmbeddingUserSourceKey } from "../embeddings/schema";
import {
  getNavigableContentSource,
  getNavigableContentSourceByTable,
  type ContentSourceTable,
  type NavigableContentKind,
} from "../content/sourceRegistry";

export const RELEVANT_CONTENT_DEFAULT_LIMIT = 3;
export const RELEVANT_CONTENT_MAX_LIMIT = 5;
const RELEVANT_CONTENT_VECTOR_LIMIT = 16;
const RELEVANT_CONTENT_LEGACY_VECTOR_LIMIT = 256;
const RELEVANT_CONTENT_SCORE_THRESHOLD = 0.3;
const RELEVANT_CONTENT_EXCERPT_MAX_CHARS = 260;

export type RelevantContentSearchCtx = Pick<
  ActionCtx,
  "runQuery" | "vectorSearch"
>;

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return RELEVANT_CONTENT_DEFAULT_LIMIT;
  return Math.max(1, Math.min(RELEVANT_CONTENT_MAX_LIMIT, Math.floor(limit)));
}

function excerptFor(chunkText: string): string {
  const compact = chunkText.replace(/\s+/g, " ").trim();
  if (compact.length <= RELEVANT_CONTENT_EXCERPT_MAX_CHARS) {
    return compact;
  }
  return `${compact.slice(0, RELEVANT_CONTENT_EXCERPT_MAX_CHARS - 3)}...`;
}

export async function findRelevantPublishedContent(
  ctx: RelevantContentSearchCtx,
  args: {
    profileOwnerId: Id<"users">;
    query: string;
    kind?: NavigableContentKind;
    limit?: number;
  },
) {
  const query = args.query.trim();
  if (!query) return [];

  const limit = normalizeLimit(args.limit);
  const { embedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: query,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS },
    },
  });

  const primaryVectorResults = await ctx.vectorSearch(
    "contentEmbeddings",
    "by_embedding",
    {
      vector: embedding,
      limit: RELEVANT_CONTENT_VECTOR_LIMIT,
      filter: (q) =>
        args.kind
          ? q.eq(
              "userSourceKey",
              buildEmbeddingUserSourceKey(
                args.profileOwnerId,
                getNavigableContentSource(args.kind).sourceTable,
              ),
            )
          : q.eq("userId", args.profileOwnerId),
    },
  );
  const legacyVectorResults =
    // Rows embedded before `userSourceKey` existed cannot match the composite
    // filter. Keep them reachable until the next backfill/regeneration pass.
    args.kind && primaryVectorResults.length < RELEVANT_CONTENT_VECTOR_LIMIT
      ? await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
          vector: embedding,
          limit: RELEVANT_CONTENT_LEGACY_VECTOR_LIMIT,
          filter: (q) => q.eq("userId", args.profileOwnerId),
        })
      : [];

  const vectorResultByChunkId = new Map(
    primaryVectorResults.map((result) => [result._id, result] as const),
  );
  for (const result of legacyVectorResults) {
    if (!vectorResultByChunkId.has(result._id)) {
      vectorResultByChunkId.set(result._id, result);
    }
  }

  const relevantResults = [...vectorResultByChunkId.values()].filter(
    (result) => result._score >= RELEVANT_CONTENT_SCORE_THRESHOLD,
  );
  if (relevantResults.length === 0) return [];

  const scoreByChunkId = new Map(
    relevantResults.map((result) => [result._id, result._score] as const),
  );
  const chunks = await ctx.runQuery(
    internal.embeddings.queries.fetchChunksByIds,
    { ids: relevantResults.map((result) => result._id) },
  );

  const bestBySource = new Map<
    string,
    {
      kind: NavigableContentKind;
      sourceId: string;
      slug: string;
      score: number;
      excerpt: string;
    }
  >();

  for (const chunk of chunks) {
    const source = getNavigableContentSourceByTable(
      chunk.sourceTable as ContentSourceTable,
    );
    if (!source) continue;
    if (args.kind && source.navigation.kind !== args.kind) continue;

    const slug = chunk.slug?.trim();
    if (!slug) continue;

    const score = scoreByChunkId.get(chunk.id);
    if (score === undefined) continue;

    const key = `${chunk.sourceTable}:${chunk.sourceId}`;
    const candidate = {
      kind: source.navigation.kind,
      sourceId: chunk.sourceId,
      slug,
      score,
      excerpt: excerptFor(chunk.chunkText),
    };
    const existing = bestBySource.get(key);
    if (!existing || candidate.score > existing.score) {
      bestBySource.set(key, candidate);
    }
  }

  const candidates = [...bestBySource.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  if (candidates.length === 0) return [];

  return await ctx.runQuery(
    internal.chat.toolQueries.resolvePublishedContentCandidates,
    {
      userId: args.profileOwnerId,
      candidates,
    },
  );
}
