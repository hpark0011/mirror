"use node";

// Internal action `importMarkdownInlineImages` for the markdown-import flow.
//
// The action walks an article's body for image nodes whose `attrs.src` is an
// absolute external URL with no `attrs.storageId`. For each such node it
// fetches the bytes via `safeFetchImage` (SSRF-guarded), stores them via
// `ctx.storage.store(blob)`, then patches the body with a Convex-served URL
// and the new `storageId`.
//
// Embedding regeneration is intentionally NOT triggered after the body
// patch. The text extractor (`embeddings/textExtractor.ts:24-33`) explicitly
// excludes image nodes from the block-types set, so image rewrites do not
// affect any extracted text. Re-running the embedding pipeline here would
// be wasted work — see spec "How data flows" markdown-import step 7.
//
// Note: the V8-runtime helpers `_readArticleBody` (internalQuery) and
// `_patchInlineImageBody` (internalMutation) live in
// `articles/internalImages.ts`. Convex requires V8 functions to be declared
// in non-`"use node"` files.

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  mapInlineImages,
  type JSONContent,
} from "../content/body-walk";
import { safeFetchImage, SafeFetchError } from "../content/safe-fetch";
import type { Id } from "../_generated/dataModel";

type ImageFailure = { src: string; reason: string };

type ImportResult = {
  imported: number;
  failed: number;
  failures: ImageFailure[];
};

export const importMarkdownInlineImages = internalAction({
  args: { articleId: v.id("articles") },
  returns: v.object({
    imported: v.number(),
    failed: v.number(),
    failures: v.array(
      v.object({
        src: v.string(),
        reason: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<ImportResult> => {
    const article: { _id: Id<"articles">; body: unknown } | null =
      await ctx.runQuery(
        internal.articles.internalImages._readArticleBody,
        { articleId: args.articleId },
      );
    if (!article) {
      return { imported: 0, failed: 0, failures: [] };
    }

    const body = (article.body ?? null) as JSONContent | null;
    if (!body) {
      return { imported: 0, failed: 0, failures: [] };
    }

    // First pass: identify each candidate image node and resolve it (if
    // possible) into `{ src → { storageId, newSrc } }`. We do this BEFORE the
    // tree rewrite so the synchronous mapper has all answers in hand.
    const candidates = collectExternalImageSrcs(body);
    const resolved = new Map<
      string,
      { storageId: Id<"_storage">; src: string }
    >();
    const failures: ImageFailure[] = [];

    for (const src of candidates) {
      if (resolved.has(src)) continue; // already resolved this URL — reuse
      try {
        const blob = await safeFetchImage(src);
        const storageId = await ctx.storage.store(blob);
        const url = await ctx.storage.getUrl(storageId);
        if (!url) {
          failures.push({ src, reason: "storage-getUrl-null" });
          continue;
        }
        resolved.set(src, { storageId, src: url });
      } catch (err) {
        const reason =
          err instanceof SafeFetchError
            ? err.code
            : err instanceof Error
              ? err.message || "unknown"
              : "unknown";
        failures.push({ src, reason });
      }
    }

    // Second pass: rewrite the body using the resolved map. Image nodes that
    // failed (or already had a storageId) are left untouched.
    const rewritten = mapInlineImages(body, (attrs) => {
      if (!attrs) return attrs;
      const existing = attrs.storageId;
      if (typeof existing === "string" && existing.length > 0) {
        return attrs; // already imported — idempotent
      }
      const src = attrs.src;
      if (typeof src !== "string" || !isAbsoluteHttpUrl(src)) {
        return attrs;
      }
      const hit = resolved.get(src);
      if (!hit) return attrs;
      return { ...attrs, src: hit.src, storageId: hit.storageId };
    });

    await ctx.runMutation(
      internal.articles.internalImages._patchInlineImageBody,
      { articleId: args.articleId, body: rewritten },
    );

    return {
      imported: resolved.size,
      failed: failures.length,
      failures,
    };
  },
});

// ---- helpers ----

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function collectExternalImageSrcs(node: JSONContent | null | undefined): string[] {
  if (!node) return [];
  const out: string[] = [];
  walk(node, out);
  return out;
}

function walk(node: JSONContent, out: string[]): void {
  if (node.type === "image") {
    const attrs = node.attrs;
    const storageId = attrs?.storageId;
    if (typeof storageId === "string" && storageId.length > 0) {
      // Already imported; skip (idempotent).
    } else {
      const src = attrs?.src;
      if (typeof src === "string" && isAbsoluteHttpUrl(src)) {
        out.push(src);
      }
    }
  }
  const children = node.content;
  if (!children) return;
  for (const child of children) {
    walk(child, out);
  }
}
