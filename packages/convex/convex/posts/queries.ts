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
 * Maximum number of unique inline-image storage IDs resolved per post in the
 * list query (`getByUsername`). The list renders a preview, not the full body,
 * so resolving every image in every post is unnecessary and expensive:
 * 100 posts × unbounded images/post ≈ O(1 000) storage calls per request.
 * Capping at 5 unique IDs/post bounds the list fan-out to ≤ 500 calls while
 * still resolving the images most likely to appear in the preview viewport.
 * Images beyond the cap keep their stale signed-URL `src`; the detail page
 * (`getBySlug`) always resolves all images without a cap.
 */
const LIST_INLINE_IMAGE_CAP = 5;

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
 *
 * @param limit - Optional cap on the number of unique storage IDs resolved.
 *   When set, only the first `limit` unique IDs are resolved; images beyond
 *   the cap keep their existing `src` (stale but bounded). Omit or pass
 *   `undefined` to resolve all images (used by `getBySlug`).
 */
async function rewriteInlineImageSrc(
  ctx: QueryCtx,
  body: JSONContent | null | undefined,
  limit?: number,
): Promise<JSONContent | null | undefined> {
  const storageIds = extractInlineImageStorageIds(body);
  if (storageIds.length === 0) return body;
  const allUniqueIds = Array.from(new Set(storageIds));
  // Apply the per-post cap for list queries. IDs beyond the cap are not
  // fetched; their image nodes will keep whatever `src` is already stored
  // (typically a stale signed URL or empty string from a previous write).
  const uniqueIds =
    limit !== undefined ? allUniqueIds.slice(0, limit) : allUniqueIds;
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
    // If the storageId was beyond the cap (not in the map), leave the
    // existing `src` untouched rather than blanking it.
    if (!urlByStorageId.has(sid as string)) {
      return attrs;
    }
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
    // Rewrite inline image `src` per post, capped at LIST_INLINE_IMAGE_CAP
    // unique storage IDs per post (FG_258). Without the cap the fan-out is
    // O(posts × images/post) — up to ~1 000 storage calls for content-heavy
    // users even with the 100-row outer cap. The cap bounds the list fan-out
    // to ≤ 500 calls while still resolving the images most likely to appear
    // in the preview viewport. The detail page (`getBySlug`) resolves all
    // images without a cap.
    const rewrittenBodies = await Promise.all(
      visible.map((p) => rewriteInlineImageSrc(ctx, p.body, LIST_INLINE_IMAGE_CAP)),
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
