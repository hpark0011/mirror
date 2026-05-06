import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  buildBioHref,
  buildContentHref,
  buildProfileSectionHref,
} from "../content/href";

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

const bioPanelReturnValidator = v.union(
  v.null(),
  v.object({
    username: v.string(),
    href: v.string(),
    hasEntries: v.boolean(),
  }),
);

/**
 * Resolve the bio panel for the profile owner. Returns:
 *  - `null` when the owner has no `username` (cannot build a profile href —
 *    same defensive shape `resolveBySlug` uses).
 *  - `{ username, href, hasEntries }` otherwise. `hasEntries` is a presence
 *    check on the `bioEntries` table (mirrors the inventory probe in
 *    `chat/helpers.ts:loadStreamingContext`) so the agent's tool result can
 *    surface "the bio panel is empty" without requiring a follow-up call.
 *
 * The bio panel itself renders the empty-state UI; the tool still resolves
 * because the panel is a real user-reachable view (Bio tab → `/@user/bio`)
 * regardless of `hasEntries`. Refusing to navigate when the panel is empty
 * would re-introduce the parity bug this verb exists to fix — the agent
 * would have to fall back to "I don't have a full bio page to pull up,"
 * which is exactly what the visitor saw before.
 *
 * Cross-user isolation is enforced by the closure-bound `profileOwnerId` in
 * `chat/tools.ts:openProfileSection` — the LLM-visible `inputSchema` carries
 * only `section`, never a user identifier.
 */
export const queryBioPanel = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: bioPanelReturnValidator,
  handler: async (ctx, { userId }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    if (!owner.username) return null;

    // Presence check only — `.take(1)` mirrors the inventory probe in
    // `chat/helpers.ts:loadStreamingContext`. The bio panel does its own
    // pagination; we only need to know whether the table is non-empty.
    const firstEntry = await ctx.db
      .query("bioEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId as Id<"users">))
      .take(1);

    return {
      username: owner.username,
      href: buildBioHref(owner.username),
      hasEntries: firstEntry.length > 0,
    };
  },
});

const profileSectionListReturnValidator = v.union(
  v.null(),
  v.object({
    kind: v.union(v.literal("articles"), v.literal("posts")),
    username: v.string(),
    href: v.string(),
    hasEntries: v.boolean(),
  }),
);

/**
 * Resolve the list-view panel for the profile owner's articles or posts.
 * Mirrors `queryBioPanel`'s shape — same null-on-missing-username defense and
 * same `hasEntries` presence semantics — so the agent's
 * `openProfileSection` tool can return one structured shape across all three
 * visitor-visible sections.
 *
 * `hasEntries` uses `take(1)` against the compound `by_userId_and_status`
 * index (mirrors `helpers.ts:loadStreamingContext`'s inventory probe). Only
 * published rows count — drafts are not retrieval-eligible and are not
 * surfaced anywhere in the visitor's view.
 *
 * Cross-user isolation is enforced by the closure-bound `profileOwnerId` in
 * `chat/tools.ts:openProfileSection`. The LLM-visible `inputSchema` carries
 * `section` only.
 */
export const queryProfileSectionList = internalQuery({
  args: {
    userId: v.id("users"),
    section: v.union(v.literal("articles"), v.literal("posts")),
  },
  returns: profileSectionListReturnValidator,
  handler: async (ctx, { userId, section }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    if (!owner.username) return null;

    const tableName = section;
    const firstRow = await ctx.db
      .query(tableName)
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId as Id<"users">).eq("status", "published"),
      )
      .take(1);

    return {
      kind: section,
      username: owner.username,
      href: buildProfileSectionHref(owner.username, section),
      hasEntries: firstRow.length > 0,
    };
  },
});
