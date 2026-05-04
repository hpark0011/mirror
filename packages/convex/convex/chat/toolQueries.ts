import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

/**
 * Canonical href builder for content the chat agent navigates the visitor to.
 *
 * Exported so unit tests can assert the exact href shape without going through
 * the tool-execute path (the convex-test harness has no first-class way to
 * invoke `Tool.execute(...)` synthetically because the AI SDK injects ctx via
 * a `__acceptsCtx` symbol). Centralizing the template here means the tool
 * surface and the test surface share one source of truth — a typo in the
 * template surfaces in both `resolveBySlug`'s return and the helper unit test.
 *
 * Format: `/@<username>/<articles|posts>/<slug>` — must stay aligned with the
 * Next.js route at `apps/mirror/app/[username]/<kind>/[slug]/page.tsx`.
 */
export function buildContentHref(
  username: string,
  kind: "articles" | "posts",
  slug: string,
): string {
  return `/@${username}/${kind}/${slug}`;
}

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
    // Ordering is by `_creationTime` descending. For normal write paths this
    // tracks `publishedAt` (a row is published shortly after it is created).
    // The known divergence is when a row is deleted and re-inserted — e.g.
    // via a migration or markdown re-import — `_creationTime` resets but
    // `publishedAt` is preserved, so the re-inserted row would surface as
    // "latest" by creation time even if a semantically newer publication
    // exists. If we ever support re-ingestion, add a
    // `by_userId_and_publishedAt` index and switch the order key here.
    //
    // Walking the iterator avoids paging in every row of the user's table
    // just to find the latest published one — we stop at the first match.
    const iter = ctx.db
      .query(tableName)
      .withIndex("by_userId", (q) => q.eq("userId", userId as Id<"users">))
      .order("desc");

    for await (const row of iter) {
      if (row.status !== "published") continue;
      return {
        slug: row.slug,
        title: row.title,
        publishedAt: row.publishedAt,
      };
    }
    return null;
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
