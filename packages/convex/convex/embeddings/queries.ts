import { v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import {
  getIndexableContentSource,
  type IndexableContentSourceTable,
} from "../content/sourceRegistry";
import { embeddingSourceTableValidator } from "./schema";
import { serializeBioEntryForEmbedding } from "../bio/serializeForEmbedding";

type DocWithStatus = Doc<"articles"> | Doc<"posts">;
type DocumentEmbeddingContent = {
  kind: "doc";
  title: string;
  body: unknown;
  slug: string;
  userId: Id<"users">;
  status: "draft" | "published";
};
type BioEmbeddingContent = {
  kind: "bio";
  title: string;
  body: string;
  userId: Id<"users">;
};
type EmbeddingContent = DocumentEmbeddingContent | BioEmbeddingContent;
type EmbeddingContentReader = (
  ctx: QueryCtx,
  sourceId: string,
) => Promise<EmbeddingContent | null>;
type EmbeddingSourceIdLister = (ctx: QueryCtx) => Promise<string[]>;

function serializeDocumentForEmbedding(
  record: DocWithStatus | null,
): DocumentEmbeddingContent | null {
  if (!record) return null;

  return {
    kind: "doc",
    title: record.title,
    body: record.body,
    slug: record.slug,
    userId: record.userId,
    status: record.status,
  };
}

const embeddingContentReaders = {
  articles: async (ctx, sourceId) =>
    serializeDocumentForEmbedding(
      await ctx.db.get(sourceId as Id<"articles">),
    ),
  posts: async (ctx, sourceId) =>
    serializeDocumentForEmbedding(await ctx.db.get(sourceId as Id<"posts">)),
  bioEntries: async (ctx, sourceId) => {
    const entry = await ctx.db.get(sourceId as Id<"bioEntries">);
    if (!entry) return null;
    const prose = serializeBioEntryForEmbedding(entry);
    return {
      kind: "bio",
      // The display title for the chunk; `serializeBioEntryForEmbedding`
      // produces a self-describing prose body, so the title is just a
      // section heading for `buildRagContext`'s `### ${title}` line.
      title: entry.title,
      body: prose,
      userId: entry.userId,
    };
  },
} satisfies Record<IndexableContentSourceTable, EmbeddingContentReader>;

const embeddingSourceIdListers = {
  articles: async (ctx) => {
    const docs = await ctx.db.query("articles").collect();
    return docs
      .filter((d) => d.status === "published")
      .map((d) => d._id as string);
  },
  posts: async (ctx) => {
    const docs = await ctx.db.query("posts").collect();
    return docs
      .filter((d) => d.status === "published")
      .map((d) => d._id as string);
  },
  bioEntries: async (ctx) => {
    // Bio entries have no draft/published lifecycle — every row is
    // "published" by definition.
    const docs = await ctx.db.query("bioEntries").collect();
    return docs.map((d) => d._id as string);
  },
} satisfies Record<IndexableContentSourceTable, EmbeddingSourceIdLister>;

export const EMBEDDING_CONTENT_READER_SOURCE_TABLES = Object.keys(
  embeddingContentReaders,
) as IndexableContentSourceTable[];

export const EMBEDDING_SOURCE_ID_LISTER_SOURCE_TABLES = Object.keys(
  embeddingSourceIdListers,
) as IndexableContentSourceTable[];

export const listPublishedContent = internalQuery({
  args: {
    sourceTable: embeddingSourceTableValidator,
  },
  returns: v.array(v.string()),
  handler: async (ctx, { sourceTable }) => {
    const source = getIndexableContentSource(sourceTable);
    return await embeddingSourceIdListers[source.sourceTable](ctx);
  },
});

/**
 * Returns a discriminated union so the consumer (`generateEmbedding`) can
 * branch on `kind`:
 *  - `kind: "doc"` — articles/posts. Has a draft/published `status` and a
 *    Tiptap JSON `body`. Subject to the published-status gate; fed through
 *    `extractPlainText` then `chunkText`.
 *  - `kind: "bio"` — bioEntries. No `status`, no Tiptap body. Pre-serialized
 *    into natural prose; bypasses the chunker (single chunk, `chunkIndex: 0`).
 *
 * Slug is omitted entirely on the bio branch (not "" — that would pollute
 * any downstream consumer that uses `slug` to build links).
 */
export const getContentForEmbedding = internalQuery({
  args: {
    sourceTable: embeddingSourceTableValidator,
    sourceId: v.string(),
  },
  returns: v.union(
    v.object({
      kind: v.literal("doc"),
      title: v.string(),
      body: v.any(),
      slug: v.string(),
      userId: v.id("users"),
      status: v.union(v.literal("draft"), v.literal("published")),
    }),
    v.object({
      kind: v.literal("bio"),
      title: v.string(),
      body: v.string(),
      userId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, { sourceTable, sourceId }) => {
    const source = getIndexableContentSource(sourceTable);
    return await embeddingContentReaders[source.sourceTable](ctx, sourceId);
  },
});

/**
 * Read path used by the chat agent's RAG step. `slug` is `v.optional(v.string())`
 * because bio chunks are stored without a slug — without this widening the
 * validator rejects every bio chunk on retrieval and the catch-block in
 * `chat/actions.ts` silently swallows the error, making bio entries
 * invisible despite being correctly written and indexed.
 */
export const fetchChunksByIds = internalQuery({
  args: {
    ids: v.array(v.id("contentEmbeddings")),
  },
  returns: v.array(
    v.object({
      id: v.id("contentEmbeddings"),
      sourceTable: embeddingSourceTableValidator,
      sourceId: v.string(),
      title: v.string(),
      slug: v.optional(v.string()),
      chunkText: v.string(),
    }),
  ),
  handler: async (ctx, { ids }) => {
    const chunks = await Promise.all(
      ids.map(async (id) => {
        const doc = await ctx.db.get(id);
        if (!doc) return null;
        return {
          id: doc._id,
          sourceTable: doc.sourceTable,
          sourceId: doc.sourceId,
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
