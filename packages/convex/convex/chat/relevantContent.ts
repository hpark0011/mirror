"use node";

import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { internal } from "../_generated/api";
import { type ActionCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../embeddings/config";

export const RELEVANT_CONTENT_DEFAULT_LIMIT = 3;
export const RELEVANT_CONTENT_MAX_LIMIT = 5;
const RELEVANT_CONTENT_VECTOR_LIMIT = 16;
const RELEVANT_CONTENT_SCORE_THRESHOLD = 0.3;
const RELEVANT_CONTENT_EXCERPT_MAX_CHARS = 260;

type NavigableContentKind = "articles" | "posts";

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

function isNavigableKind(
  sourceTable: "articles" | "posts" | "bioEntries",
): sourceTable is NavigableContentKind {
  return sourceTable === "articles" || sourceTable === "posts";
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

  const vectorResults = await ctx.vectorSearch(
    "contentEmbeddings",
    "by_embedding",
    {
      vector: embedding,
      limit: RELEVANT_CONTENT_VECTOR_LIMIT,
      filter: (q) => q.eq("userId", args.profileOwnerId),
    },
  );

  const relevantResults = vectorResults.filter(
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
      slug: string;
      score: number;
      excerpt: string;
    }
  >();

  for (const chunk of chunks) {
    if (!isNavigableKind(chunk.sourceTable)) continue;
    if (args.kind && chunk.sourceTable !== args.kind) continue;

    const slug = chunk.slug?.trim();
    if (!slug) continue;

    const score = scoreByChunkId.get(chunk.id);
    if (score === undefined) continue;

    const key = `${chunk.sourceTable}:${chunk.sourceId}`;
    const candidate = {
      kind: chunk.sourceTable,
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
