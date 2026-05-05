import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { buildContentHref } from "../content/href";

// Re-exported so existing test imports
// (`packages/convex/convex/chat/__tests__/tools.test.ts`) and any future
// chat-package consumers can keep importing `buildContentHref` from
// `../toolQueries` while the canonical implementation lives at
// `../content/href` (see `.claude/rules/agent-parity.md` § Href-parity).
export { buildContentHref };

/**
 * Tool-side internal queries powering `buildCloneTools` in `chat/tools.ts`.
 *
 * Critical isolation invariant (matches `.claude/rules/embeddings.md`):
 * `userId` here is a SERVER-derived argument — `chat/actions.ts:streamResponse`
 * already has `profileOwnerId` in scope and the tool factory closes over it.
 * The LLM-visible tool `inputSchema` MUST NOT expose `userId`. These queries
 * are internal-only and are not reachable from any client code path.
 *
 * Articles and posts queries pin `status === "published"` so:
 *  - `queryLatestPublished` never returns drafts (consistent with what RAG
 *    chunks see; drafts are not retrieval-eligible).
 *  - `resolveBySlug` returns `null` for drafts even when slug + userId match,
 *    so a chat agent cannot navigate the visitor to an unpublished URL.
 */

const latestPublishedReturnValidator = v.union(
  v.null(),
  v.object({
    slug: v.string(),
    title: v.string(),
    publishedAt: v.optional(v.number()),
  }),
);

const resolveBySlugReturnValidator = v.union(
  v.null(),
  v.object({
    kind: v.union(v.literal("articles"), v.literal("posts")),
    slug: v.string(),
    title: v.string(),
    publishedAt: v.optional(v.number()),
    username: v.string(),
    href: v.string(),
  }),
);

const contentKindValidator = v.union(
  v.literal("articles"),
  v.literal("posts"),
);

/**
 * Most recent PUBLISHED article or post for the given user. Returns `null`
 * when the user has no published item of that kind.
 */
export const queryLatestPublished = internalQuery({
  args: {
    userId: v.id("users"),
    kind: contentKindValidator,
  },
  returns: latestPublishedReturnValidator,
  handler: async (ctx, { userId, kind }) => {
    const tableName = kind;
    // The compound index pins the scan to published rows and orders by the
    // semantic publish timestamp. Ordering by `_creationTime` would return the
    // wrong "latest" item when an older draft is published after a newer row.
    const row = await ctx.db
      .query(tableName)
      .withIndex("by_userId_status_publishedAt", (q) =>
        q.eq("userId", userId as Id<"users">).eq("status", "published"),
      )
      .order("desc")
      .first();
    if (!row) return null;
    return {
      slug: row.slug,
      title: row.title,
      publishedAt: row.publishedAt,
    };
  },
});

/**
 * Resolve an article/post by `(userId, slug)`. Returns `null` when:
 *  - no row with that slug exists for that user,
 *  - the row exists but is a draft (status !== "published"),
 *  - the owning user has no `username` (cannot build a valid profile href).
 *
 * Returns the row plus the owner's `username` and a server-built `href`. The
 * `navigateToContent` tool returns the same `href` to the client unchanged —
 * keeping the template here means a typo in the URL shape surfaces in
 * `__tests__/tools.test.ts` (which asserts against `buildContentHref`)
 * instead of as a silent 404 in production.
 *
 * Cross-user isolation is enforced by the `userId` clause on the
 * `by_userId_and_slug` index — a slug owned by user B is never returned for a
 * query keyed on user A.
 */
export const resolveBySlug = internalQuery({
  args: {
    userId: v.id("users"),
    kind: contentKindValidator,
    slug: v.string(),
  },
  returns: resolveBySlugReturnValidator,
  handler: async (ctx, { userId, kind, slug }) => {
    const tableName = kind;
    const row = await ctx.db
      .query(tableName)
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", userId as Id<"users">).eq("slug", slug),
      )
      .unique();
    if (!row) return null;
    if (row.status !== "published") return null;

    const owner = await ctx.db.get(row.userId);
    if (!owner) return null;
    // `users.username` is `v.optional(v.string())`. A row without a username
    // cannot produce a valid profile href, so treat it as not-resolvable
    // rather than emitting a malformed `/@/...` link to the navigator.
    if (!owner.username) return null;

    return {
      kind,
      slug: row.slug,
      title: row.title,
      publishedAt: row.publishedAt,
      username: owner.username,
      href: buildContentHref(owner.username, kind, row.slug),
    };
  },
});
