import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import {
  filterVisibleContent,
  getUserAndContentAccess,
} from "../content/helpers";
import {
  postSummaryReturnValidator,
  postWithBodyReturnValidator,
  resolvePostCoverUrls,
  serializePost,
} from "./helpers";
import {
  extractInlineImageStorageIds,
  mapInlineImages,
  type JSONContent,
} from "../content/bodyWalk";
import { type Id } from "../_generated/dataModel";

/**
 * Rewrite every inline image node's `src` from its `storageId` so the body
 * always renders with a fresh Convex signed URL (FR-05). Matches the
 * articles-side helper pattern: pre-resolves all storage URLs in parallel,
 * then runs the sync `mapInlineImages` walker against a lookup map.
 *
 * Used by both the detail (`getBySlug`) and the list (`getByUsername`)
 * queries — without it, list view renders broken images for any post older
 * than the signed-URL TTL (~1h) since `posts.body` is stored verbatim.
 *
 * Image nodes lacking a `storageId` keep their existing `src` (legacy
 * external URLs); nodes whose blob is gone get `src: ""` so the <img>
 * fails locally rather than rendering a stale signed URL — matches the
 * spec edge-case "Query-time fallback: leave `src` empty".
 */
async function rewriteInlineImageSrc(
  ctx: QueryCtx,
  body: JSONContent | null | undefined,
): Promise<JSONContent | null | undefined> {
  const storageIds = extractInlineImageStorageIds(body);
  if (storageIds.length === 0) return body;
  const uniqueIds = Array.from(new Set(storageIds));
  const urls = await Promise.all(
    uniqueIds.map((id) => ctx.storage.getUrl(id as Id<"_storage">)),
  );
  const urlByStorageId = new Map<string, string | null>();
  for (let i = 0; i < uniqueIds.length; i++) {
    urlByStorageId.set(uniqueIds[i]!, urls[i] ?? null);
  }
  return mapInlineImages(body, (attrs) => {
    if (!attrs) return attrs;
    const sid = attrs.storageId;
    if (typeof sid !== "string" || sid.length === 0) return attrs;
    const resolved = urlByStorageId.get(sid);
    if (resolved == null) {
      return { ...attrs, src: "" };
    }
    return { ...attrs, src: resolved };
  });
}

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(postSummaryReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const access = await getUserAndContentAccess(ctx, args.username);
    if (!access) {
      return null;
    }

    const { user, isOwner } = access;
    // Server-side cap so the list, cover-URL Promise.all, and inline-image
    // rewrite Promise.all all scale O(1) per request instead of O(posts).
    //
    // Non-owners read only `published` rows via the status index. If we
    // capped `by_userId` first and filtered visibility after, drafts in the
    // oldest 100 rows would consume cap slots and silently hide later
    // published posts from the public list (the FG_248 cap × visibility
    // interaction). Querying the status index makes the cap count only
    // posts the visitor can actually see.
    //
    // Owners see every status; the 100-row cap is the documented FG_248
    // tradeoff — once a user crosses 100 posts the list UI must move to
    // usePaginatedQuery.
    const posts = isOwner
      ? await ctx.db
          .query("posts")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .take(100)
      : await ctx.db
          .query("posts")
          .withIndex("by_userId_and_status", (q) =>
            q.eq("userId", user._id).eq("status", "published"),
          )
          .take(100);

    // Defense in depth: a no-op for the non-owner branch (already
    // published-only) and keeps every row for owners, but keeps the
    // visibility invariant visible at this call site.
    const visible = filterVisibleContent(posts, isOwner);
    const coverUrls = await Promise.all(
      visible.map((p) => resolvePostCoverUrls(ctx, p)),
    );
    // Rewrite inline image `src` per post. Bounded by the list page size and
    // the per-post image count — Policy A from FG_093. Without this, the
    // post list shows broken images for any post older than the signed-URL
    // TTL because `postSummaryReturnValidator` includes `body: v.any()` and
    // the editor stores image src as a Convex signed URL captured at upload
    // time (mutations write the body verbatim).
    const rewrittenBodies = await Promise.all(
      visible.map((p) => rewriteInlineImageSrc(ctx, p.body)),
    );

    return visible.map((post, i) =>
      serializePost({ ...post, body: rewrittenBodies[i] }, coverUrls[i]!),
    );
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

    const coverUrls = await resolvePostCoverUrls(ctx, post);

    // Rewrite inline image `src` from `storageId` (FR-05). See the matching
    // articles `getBySlug` for the sync-mapper-with-pre-resolved-urls pattern.
    const rewrittenBody = await rewriteInlineImageSrc(ctx, post.body);

    return serializePost({ ...post, body: rewrittenBody }, coverUrls);
  },
});
