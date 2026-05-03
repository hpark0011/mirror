"use node";

// Internal action `importMarkdownInlineImages` for the markdown-import flow.
//
// PRECONDITION: caller has verified the authenticated user owns
// `args.postId`. The public wrapper in `posts/inlineImages.ts`
// (`importPostMarkdownInlineImages`) is the only safe entrypoint — it
// performs the auth + ownership check via `authComponent.getAuthUser` +
// `_getPostOwnership`, then delegates here.
//
// Defense in depth (FG_104): this action ALSO takes an `ownerId: v.id("users")`
// arg and re-verifies that the loaded post's `userId` matches before
// proceeding. The public wrapper passes the verified owner through. If a
// future internal caller bypasses the wrapper without re-deriving the owner,
// the mismatch throws.
//
// Thin wrapper around `importMarkdownInlineImagesCore` (FG_095). The shared
// helper is entity-agnostic: this file is responsible only for reading the
// post body via the V8-runtime `_readPostBody` query and wiring the
// entity-specific `_patchInlineImageBody` mutation as a closure that the
// helper invokes once with the rewritten body.
//
// Embedding regeneration is intentionally NOT triggered after the body
// patch. The text extractor (`embeddings/textExtractor.ts:24-33`) explicitly
// excludes image nodes from the block-types set, so image rewrites do not
// affect any extracted text. Re-running the embedding pipeline here would
// be wasted work — see spec "How data flows" markdown-import step 7.
//
// Note: the V8-runtime helpers `_readPostBody` (internalQuery) and
// `_patchInlineImageBody` (internalMutation) live in
// `posts/internalImages.ts`. Convex requires V8 functions to be declared in
// non-`"use node"` files.

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
  args: {
    postId: v.id("posts"),
    ownerId: v.id("users"),
  },
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
    const post: {
      _id: Id<"posts">;
      userId: Id<"users">;
      body: unknown;
    } | null = await ctx.runQuery(
      internal.posts.internalImages._readPostBody,
      { postId: args.postId },
    );
    if (!post) {
      return { imported: 0, failed: 0, failures: [] };
    }
    // Defense in depth: the public wrapper already verified ownership, but
    // re-check here so a future internal caller that bypasses the wrapper
    // cannot silently process another user's post.
    if (post.userId !== args.ownerId) {
      throw new Error("Not the owner");
    }
    const body = (post.body ?? null) as JSONContent | null;
    return importMarkdownInlineImagesCore(ctx, body, async (srcMap) => {
      await ctx.runMutation(
        internal.posts.internalImages._patchInlineImageBody,
        { postId: args.postId, srcMap },
      );
    });
  },
});
