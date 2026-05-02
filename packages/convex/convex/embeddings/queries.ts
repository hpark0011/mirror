import { v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { embeddingSourceTableValidator } from "./schema";
import { serializeBioEntryForEmbedding } from "../bio/serializeForEmbedding";

type DocWithStatus = Doc<"articles"> | Doc<"posts">;

export const listPublishedContent = internalQuery({
  args: {
    sourceTable: embeddingSourceTableValidator,
  },
  returns: v.array(v.string()),
  handler: async (ctx, { sourceTable }) => {
    if (sourceTable === "bioEntries") {
      // Bio entries have no draft/published lifecycle — every row is
      // "published" by definition.
      const docs = await ctx.db.query("bioEntries").collect();
      return docs.map((d) => d._id as string);
    }
    const docs = await ctx.db.query(sourceTable).collect();
    return docs
      .filter((d) => (d as DocWithStatus).status === "published")
      .map((d) => d._id as string);
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
    if (sourceTable === "bioEntries") {
      const entry = await ctx.db.get(sourceId as Id<"bioEntries">);
      if (!entry) return null;
      const prose = serializeBioEntryForEmbedding(entry);
      return {
        kind: "bio" as const,
        // The display title for the chunk; `serializeBioEntryForEmbedding`
        // produces a self-describing prose body, so the title is just a
        // section heading for `buildRagContext`'s `### ${title}` line.
        title: entry.title,
        body: prose,
        userId: entry.userId,
      };
    }

    const doc =
      sourceTable === "articles"
        ? await ctx.db.get(sourceId as Id<"articles">)
        : await ctx.db.get(sourceId as Id<"posts">);
    if (!doc) return null;

    const record = doc as DocWithStatus;
    return {
      kind: "doc" as const,
      title: record.title,
      body: record.body,
      slug: record.slug,
      userId: record.userId,
      status: record.status,
    };
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
