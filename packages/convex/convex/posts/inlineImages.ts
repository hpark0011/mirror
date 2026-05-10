// Public mutations + queries for the inline-image lifecycle on posts.
//
// Read-side trust boundary (accepted trade-off, per spec):
// `getPostInlineImageUrl` is wrapped in `authQuery`, so any authenticated
// user can pass any `Id<"_storage">` and receive a fresh signed URL for it.
// We DO NOT add a per-call ownership check, because:
//   (a) Mirror's post bodies are predominantly publicly readable, so most
//       inline image URLs are already accessible to any reader of a published
//       post;
//   (b) `_storage` IDs are random tokens, not predictable, so an attacker
//       cannot enumerate them;
//   (c) the practical attack (extract a storageId from a draft body) requires
//       already having read access to the body, which means the image was
//       already accessible.
// If Mirror later supports private posts with stronger visibility rules,
// this query MUST be revisited and an ownership check added.

import { v } from "convex/values";
import { authMutation, authQuery } from "../lib/auth";

export const generatePostInlineImageUploadUrl = authMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getPostInlineImageUrl = authQuery({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
