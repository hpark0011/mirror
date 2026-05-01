import { query } from "../_generated/server";
import { v } from "convex/values";
import {
  filterVisibleContent,
  getUserAndContentAccess,
} from "../content/helpers";
import {
  postSummaryReturnValidator,
  postWithBodyReturnValidator,
  resolvePostCoverImageUrl,
  serializePost,
} from "./helpers";
import {
  extractInlineImageStorageIds,
  mapInlineImages,
} from "../content/body-walk";
import type { Id } from "../_generated/dataModel";

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(postSummaryReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const visible = filterVisibleContent(posts, isOwner);
    const coverImageUrls = await Promise.all(
      visible.map((p) => resolvePostCoverImageUrl(ctx, p.coverImageStorageId)),
    );

    return visible.map((post, i) => serializePost(post, coverImageUrls[i]!));
  },
});

export const getBySlug = query({
  args: { username: v.string(), slug: v.string() },
  returns: v.union(postWithBodyReturnValidator, v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;
    const post = await ctx.db
      .query("posts")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", user._id).eq("slug", args.slug),
      )
      .unique();
    if (!post) {
      return null;
    }

    if (post.status === "draft" && !isOwner) {
      return null;
    }

    const coverImageUrl = await resolvePostCoverImageUrl(
      ctx,
      post.coverImageStorageId,
    );

    // Rewrite inline image `src` from `storageId` (FR-05). See the matching
    // articles `getBySlug` for the sync-mapper-with-pre-resolved-urls pattern.
    const storageIds = extractInlineImageStorageIds(post.body);
    const uniqueIds = Array.from(new Set(storageIds));
    const urls = await Promise.all(
      uniqueIds.map((id) => ctx.storage.getUrl(id as Id<"_storage">)),
    );
    const urlByStorageId = new Map<string, string | null>();
    for (let i = 0; i < uniqueIds.length; i++) {
      urlByStorageId.set(uniqueIds[i]!, urls[i] ?? null);
    }
    const rewrittenBody = mapInlineImages(post.body, (attrs) => {
      if (!attrs) return attrs;
      const sid = attrs.storageId;
      if (typeof sid !== "string" || sid.length === 0) return attrs;
      const resolved = urlByStorageId.get(sid);
      if (resolved == null) {
        // Missing blob: leave `src` empty so the <img> fails to load locally
        // rather than rendering a stale signed URL. Spec edge-case:
        // "ctx.storage.getUrl(storageId) returns null when blob is gone —
        //  Query-time fallback: leave `src` empty."
        return { ...attrs, src: "" };
      }
      return { ...attrs, src: resolved };
    });

    return serializePost({ ...post, body: rewrittenBody }, coverImageUrl);
  },
});
