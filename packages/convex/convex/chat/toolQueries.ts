import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { type Doc, type Id } from "../_generated/dataModel";
import { contentStatusValidator } from "../content/schema";
import {
  getNavigableContentSource,
  type NavigableContentKind,
  type NavigableContentSourceTable,
} from "../content/sourceRegistry";
import { navigableContentKindValidator } from "../content/sourceValidators";
import { bioEntryKindValidator } from "../bio/schema";
import { contactEntryKindValidator } from "../contacts/schema";
import {
  buildBioHref,
  buildContactHref,
  buildContentEditHref,
  buildContentHref,
  buildProfileSectionHref,
} from "../content/href";
import {
  analyzeAgentBodyProjection,
  tiptapDocToAgentBlocks,
  tiptapDocToPlainText,
} from "../content/agentBody";

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
 * Visitor-navigation article/post queries pin `status === "published"` so:
 *  - `queryLatestPublished` never returns drafts (consistent with what RAG
 *    chunks see; drafts are not retrieval-eligible).
 *  - `resolveBySlug` returns `null` for drafts even when slug + userId match,
 *    so a chat agent cannot navigate the visitor to an unpublished URL.
 *
 * Owner-write tools use `resolveOwnedContentBySlug` below instead, which is
 * still `(profileOwnerId, slug)` scoped but intentionally permits drafts.
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
    kind: navigableContentKindValidator,
    slug: v.string(),
    title: v.string(),
    publishedAt: v.optional(v.number()),
    username: v.string(),
    href: v.string(),
  }),
);

const resolveOwnedContentBySlugReturnValidator = v.union(
  v.null(),
  v.object({
    kind: navigableContentKindValidator,
    slug: v.string(),
    title: v.string(),
    status: contentStatusValidator,
    publishedAt: v.optional(v.number()),
    username: v.string(),
    href: v.string(),
  }),
);


const profileConfigurationReturnValidator = v.object({
  username: v.string(),
  bioHref: v.string(),
  contactHref: v.string(),
  bioEntries: v.array(
    v.object({
      _id: v.id("bioEntries"),
      kind: bioEntryKindValidator,
      title: v.string(),
      startDate: v.number(),
      endDate: v.union(v.number(), v.null()),
      description: v.optional(v.string()),
      link: v.optional(v.string()),
    }),
  ),
  contactEntries: v.array(
    v.object({
      _id: v.id("contactEntries"),
      kind: contactEntryKindValidator,
      value: v.string(),
    }),
  ),
});

const relevantContentCandidateValidator = v.object({
  kind: navigableContentKindValidator,
  sourceId: v.string(),
  slug: v.string(),
  score: v.number(),
  excerpt: v.string(),
});

const resolvePublishedContentCandidatesReturnValidator = v.array(
  v.object({
    kind: navigableContentKindValidator,
    slug: v.string(),
    title: v.string(),
    publishedAt: v.optional(v.number()),
    username: v.string(),
    href: v.string(),
    excerpt: v.string(),
    score: v.number(),
  }),
);

/**
 * Most recent PUBLISHED article or post for the given user. Returns `null`
 * when the user has no published item of that kind.
 */
export const queryLatestPublished = internalQuery({
  args: {
    userId: v.id("users"),
    kind: navigableContentKindValidator,
  },
  returns: latestPublishedReturnValidator,
  handler: async (ctx, { userId, kind }) => {
    const source = getNavigableContentSource(kind);
    // The compound index pins the scan to published rows and orders by the
    // semantic publish timestamp. Ordering by `_creationTime` would return the
    // wrong "latest" item when an older draft is published after a newer row.
    const row = await ctx.db
      .query(source.sourceTable)
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
    kind: navigableContentKindValidator,
    slug: v.string(),
  },
  returns: resolveBySlugReturnValidator,
  handler: async (ctx, { userId, kind, slug }) => {
    const source = getNavigableContentSource(kind);
    const row = await ctx.db
      .query(source.sourceTable)
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

/**
 * Batch-resolve semantic search candidates into visitor-navigable rows.
 *
 * Embeddings can be stale: a row may have been unpublished, deleted, or
 * renamed after its chunk was written. This query re-checks each candidate
 * against the canonical content tables by source id, scopes every lookup to
 * the server-derived profile owner, and returns only published rows with a
 * valid owner username. Input order is preserved so vector ranking remains
 * intact, and stale embedding slugs are replaced with the row's current slug.
 */
export const resolvePublishedContentCandidates = internalQuery({
  args: {
    userId: v.id("users"),
    candidates: v.array(relevantContentCandidateValidator),
  },
  returns: resolvePublishedContentCandidatesReturnValidator,
  handler: async (ctx, { userId, candidates }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return [];
    if (!owner.username) return [];

    const rows: Array<{
      kind: NavigableContentKind;
      slug: string;
      title: string;
      publishedAt?: number;
      username: string;
      href: string;
      excerpt: string;
      score: number;
    }> = [];
    for (const candidate of candidates) {
      const source = getNavigableContentSource(candidate.kind);
      const row = await ctx.db.get(
        candidate.sourceId as Id<NavigableContentSourceTable>,
      );

      if (!row) continue;
      if (row.userId !== userId) continue;
      if (row.status !== "published") continue;

      rows.push({
        kind: candidate.kind,
        slug: row.slug,
        title: row.title,
        publishedAt: row.publishedAt,
        username: owner.username,
        href: buildContentHref(
          owner.username,
          source.navigation.kind,
          row.slug,
        ),
        excerpt: candidate.excerpt,
        score: candidate.score,
      });
    }

    return rows;
  },
});

/**
 * Resolve an owner-authored article/post by `(userId, slug)` for write tools.
 *
 * Unlike `resolveBySlug`, this intentionally allows drafts. Visitor-facing
 * navigation tools must stay published-only, but owner-write tools need to
 * find drafts so `publishPost`/`publishArticle` can flip them to published.
 * This remains internal-only and still pins lookup to the closure-bound
 * `profileOwnerId` supplied by `buildCloneTools`.
 */
export const resolveOwnedContentBySlug = internalQuery({
  args: {
    userId: v.id("users"),
    kind: navigableContentKindValidator,
    slug: v.string(),
  },
  returns: resolveOwnedContentBySlugReturnValidator,
  handler: async (ctx, { userId, kind, slug }) => {
    const source = getNavigableContentSource(kind);
    const row = await ctx.db
      .query(source.sourceTable)
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", userId as Id<"users">).eq("slug", slug),
      )
      .unique();
    if (!row) return null;

    const owner = await ctx.db.get(row.userId);
    if (!owner) return null;
    if (!owner.username) return null;

    return {
      kind,
      slug: row.slug,
      title: row.title,
      status: row.status,
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

export const queryProfileConfiguration = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(profileConfigurationReturnValidator, v.null()),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user?.username) return null;

    const [bioEntries, contactEntries] = await Promise.all([
      ctx.db
        .query("bioEntries")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(50),
      ctx.db
        .query("contactEntries")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(10),
    ]);

    bioEntries.sort((a, b) => {
      if (a.startDate !== b.startDate) return b.startDate - a.startDate;
      return b._creationTime - a._creationTime;
    });
    contactEntries.sort((a, b) => b._creationTime - a._creationTime);

    return {
      username: user.username,
      bioHref: buildBioHref(user.username),
      contactHref: buildContactHref(user.username),
      bioEntries: bioEntries.map((entry) => ({
        _id: entry._id,
        kind: entry.kind,
        title: entry.title,
        startDate: entry.startDate,
        endDate: entry.endDate,
        description: entry.description,
        link: entry.link,
      })),
      contactEntries: contactEntries.map((entry) => ({
        _id: entry._id,
        kind: entry.kind,
        value: entry.value,
      })),
    };
  },
});

const contactPanelReturnValidator = v.union(
  v.null(),
  v.object({
    username: v.string(),
    href: v.string(),
    hasEntries: v.boolean(),
  }),
);

/**
 * Resolve the contact panel for the profile owner. Mirrors `queryBioPanel`:
 *  - `null` when the owner has no `username` (cannot build a profile href).
 *  - `{ username, href, hasEntries }` otherwise.
 *
 * `hasEntries` is a presence check on the `contactEntries` table — the agent
 * uses it to acknowledge an empty panel before opening it (parallels the
 * empty-bio branch). Cross-user isolation is enforced by the closure-bound
 * `profileOwnerId` in `chat/tools.ts:openProfileSection`.
 */
export const queryContactPanel = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: contactPanelReturnValidator,
  handler: async (ctx, { userId }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    if (!owner.username) return null;

    const firstEntry = await ctx.db
      .query("contactEntries")
      .withIndex("by_userId", (q) => q.eq("userId", userId as Id<"users">))
      .take(1);

    return {
      username: owner.username,
      href: buildContactHref(owner.username),
      hasEntries: firstEntry.length > 0,
    };
  },
});

const profileSectionListReturnValidator = v.union(
  v.null(),
  v.object({
    kind: navigableContentKindValidator,
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
    section: navigableContentKindValidator,
  },
  returns: profileSectionListReturnValidator,
  handler: async (ctx, { userId, section }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    if (!owner.username) return null;

    const source = getNavigableContentSource(section);
    const firstRow = await ctx.db
      .query(source.sourceTable)
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

// PLAN_013: owner-only content read tools for the configuration agent.
//
// These queries return DRAFTS in addition to published rows because
// configuration mode is owner-only and the agent's `applyContentPatch`
// tool needs to address every owned content row by slug, not just the
// publicly visible ones. Cross-user isolation is enforced via the
// closure-bound `profileOwnerId` in `chat/configurationTools.ts`; the
// LLM-visible `inputSchema` carries only `kind`, `status`, `limit`, and
// `slug` — never any user identifier (see `.claude/rules/agent-parity.md`).
//
// `queryOwnedContentForEdit` returns the body projected to agent blocks
// + plain text via `content/agentBody.ts`; the raw Tiptap JSON is
// intentionally NOT exposed to the LLM (see plan, Constraints).

const profileContentLibraryItemValidator = v.object({
  kind: navigableContentKindValidator,
  slug: v.string(),
  title: v.string(),
  category: v.string(),
  status: contentStatusValidator,
  createdAt: v.number(),
  publishedAt: v.optional(v.number()),
  href: v.string(),
  editHref: v.string(),
});

const profileContentLibraryReturnValidator = v.union(
  v.null(),
  v.object({
    username: v.string(),
    listHrefs: v.object({
      posts: v.string(),
      articles: v.string(),
    }),
    items: v.array(profileContentLibraryItemValidator),
  }),
);

const PROFILE_CONTENT_LIBRARY_DEFAULT_LIMIT = 25;
const PROFILE_CONTENT_LIBRARY_MAX_LIMIT = 50;

/**
 * Lists the profile owner's draft + published posts/articles for the
 * configuration agent. Returns at most `limit` rows per requested kind
 * (default 25, capped at 50), most recent first by `_creationTime`.
 *
 * When `kind` is omitted, both posts and articles are included. When
 * `status` is omitted, drafts AND published rows are included — owner-only
 * tool, so drafts are valid context the agent should reason about.
 */
export const queryProfileContentLibrary = internalQuery({
  args: {
    userId: v.id("users"),
    kind: v.optional(navigableContentKindValidator),
    status: v.optional(contentStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: profileContentLibraryReturnValidator,
  handler: async (ctx, { userId, kind, status, limit }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    if (!owner.username) return null;

    const requestedKinds: NavigableContentKind[] = kind
      ? [kind]
      : ["posts", "articles"];

    const effectiveLimit = Math.min(
      Math.max(1, limit ?? PROFILE_CONTENT_LIBRARY_DEFAULT_LIMIT),
      PROFILE_CONTENT_LIBRARY_MAX_LIMIT,
    );

    const collectedArrays = await Promise.all(
      requestedKinds.map(async (k) => {
        const source = getNavigableContentSource(k);
        const rows = status
          ? await ctx.db
              .query(source.sourceTable)
              .withIndex("by_userId_and_status", (q) =>
                q.eq("userId", userId as Id<"users">).eq("status", status),
              )
              .order("desc")
              .take(effectiveLimit)
          : await ctx.db
              .query(source.sourceTable)
              .withIndex("by_userId", (q) =>
                q.eq("userId", userId as Id<"users">),
              )
              .order("desc")
              .take(effectiveLimit);

        return rows.map((row) => ({
          kind: k,
          row,
        }));
      }),
    );

    const collected: Array<{
      kind: NavigableContentKind;
      row: Doc<"posts"> | Doc<"articles">;
    }> = collectedArrays.flat();

    collected.sort((a, b) => b.row._creationTime - a.row._creationTime);

    const username = owner.username;
    return {
      username,
      listHrefs: {
        posts: buildContentHref(username, "posts"),
        articles: buildContentHref(username, "articles"),
      },
      items: collected.slice(0, effectiveLimit * requestedKinds.length).map(
        ({ kind, row }) => ({
          kind,
          slug: row.slug,
          title: row.title,
          category: row.category,
          status: row.status,
          createdAt: row.createdAt,
          publishedAt: row.publishedAt,
          href: buildContentHref(username, kind, row.slug),
          editHref: buildContentEditHref(username, kind, row.slug),
        }),
      ),
    };
  },
});

const ownedContentForEditReturnValidator = v.union(
  v.null(),
  v.object({
    kind: navigableContentKindValidator,
    slug: v.string(),
    title: v.string(),
    category: v.string(),
    status: contentStatusValidator,
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
    username: v.string(),
    href: v.string(),
    editHref: v.string(),
    bodyText: v.string(),
    bodyBlocks: v.array(
      v.union(
        v.object({
          type: v.literal("paragraph"),
          text: v.string(),
        }),
        v.object({
          type: v.literal("heading"),
          level: v.union(v.literal(2), v.literal(3)),
          text: v.string(),
        }),
        v.object({
          type: v.literal("bulletList"),
          items: v.array(v.string()),
        }),
      ),
    ),
    // True when `bodyBlocks` cannot represent the stored body (image
    // nodes, code blocks, ordered lists, links, formatted text, etc.).
    // The agent uses this to refuse silent body replacement and ask the
    // owner to confirm in plain text.
    projectionLossy: v.boolean(),
    unsupportedNodeTypes: v.array(v.string()),
  }),
);

/**
 * Resolve a single owned post/article for the configuration agent. Returns
 * `null` when:
 *   - the owner has no `username` (cannot build a valid profile href),
 *   - no row with that slug exists for the owner.
 *
 * Drafts ARE returned (owner-only tool); the agent uses this to inspect an
 * existing body before deciding whether to replace it.
 *
 * The response includes both a plain-text body (`bodyText`) and an agent
 * block projection (`bodyBlocks`) so the LLM can read the body without
 * ever touching raw Tiptap JSON. `projectionLossy` is the explicit signal
 * the agent uses to decide whether a body replacement would silently
 * discard structure (images, code blocks, ordered lists, marks, etc.);
 * `unsupportedNodeTypes` lists what the projection cannot represent so the
 * agent can name them when asking the owner to confirm. See
 * `content/agentBody.ts` for the projection rules.
 */
export const queryOwnedContentForEdit = internalQuery({
  args: {
    userId: v.id("users"),
    kind: navigableContentKindValidator,
    slug: v.string(),
  },
  returns: ownedContentForEditReturnValidator,
  handler: async (ctx, { userId, kind, slug }) => {
    const owner = await ctx.db.get(userId);
    if (!owner) return null;
    if (!owner.username) return null;

    const source = getNavigableContentSource(kind);
    const row = await ctx.db
      .query(source.sourceTable)
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", userId as Id<"users">).eq("slug", slug),
      )
      .unique();
    if (!row) return null;

    const projection = analyzeAgentBodyProjection(row.body);
    return {
      kind,
      slug: row.slug,
      title: row.title,
      category: row.category,
      status: row.status,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
      username: owner.username,
      href: buildContentHref(owner.username, kind, row.slug),
      editHref: buildContentEditHref(owner.username, kind, row.slug),
      bodyText: tiptapDocToPlainText(row.body),
      bodyBlocks: tiptapDocToAgentBlocks(row.body),
      projectionLossy: projection.lossy,
      unsupportedNodeTypes: projection.unsupportedNodeTypes,
    };
  },
});
