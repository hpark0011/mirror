"use node";

// Internal action `importMarkdownInlineImages` for the markdown-import flow.
//
// Thin wrapper around `importMarkdownInlineImagesCore` (FG_095). The shared
// helper is entity-agnostic: this file is responsible only for reading the
// article body via the V8-runtime `_readArticleBody` query and wiring the
// entity-specific `_patchInlineImageBody` mutation as a closure that the
// helper invokes once with the rewritten body.
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
  importMarkdownInlineImagesCore,
  type ImportResult,
} from "../content/markdownImport";
import type { JSONContent } from "../content/body-walk";
import type { Id } from "../_generated/dataModel";

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
    return importMarkdownInlineImagesCore(ctx, body, async (srcMap) => {
      await ctx.runMutation(
        internal.articles.internalImages._patchInlineImageBody,
        { articleId: args.articleId, srcMap },
      );
    });
  },
});
