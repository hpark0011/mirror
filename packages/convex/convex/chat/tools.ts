"use node";

import { z } from "zod";
import { createTool } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";
import {
  getNavigableContentSource,
  NAVIGABLE_CONTENT_KINDS,
  type NavigableContentKind,
} from "../content/sourceRegistry";
import {
  findRelevantPublishedContent,
  RELEVANT_CONTENT_MAX_LIMIT,
  type RelevantContentSearchCtx,
} from "./relevantContent";

type ContentKind = NavigableContentKind;
type ContentStatus = "draft" | "published";
const NAVIGABLE_CONTENT_KIND_ENUM_VALUES = NAVIGABLE_CONTENT_KINDS as [
  ContentKind,
  ...ContentKind[],
];

type OwnedContentRow = {
  kind: ContentKind;
  slug: string;
  title: string;
  status: ContentStatus;
  publishedAt?: number;
  username: string;
  href: string;
};

type StatusMutationResult =
  | {
      updated: true;
      changed: boolean;
      kind: ContentKind;
      slug: string;
      title: string;
      status: ContentStatus;
      previousStatus: ContentStatus;
      publishedAt?: number;
    }
  | {
      updated: false;
      kind: ContentKind;
      slug: string;
      status: ContentStatus;
    };

type ProfileSectionList = {
  kind: ContentKind;
  username: string;
  href: string;
  hasEntries: boolean;
};

type BuildCloneToolsOptions = {
  viewerId?: Id<"users">;
};

/**
 * Per-request tool factory for the clone agent.
 *
 * The factory closes over `profileOwnerId` so the LLM can never pass a
 * different user's id through tool arguments. Owner-write tools also check
 * the server-derived `viewerId` before doing any lookup or mutation. The
 * `inputSchema` of every tool here MUST NOT include a `userId` field — the
 * cross-user isolation boundary is the same one the RAG side uses
 * (`vectorSearch.filter` keyed on `profileOwnerId`, or on a composite
 * owner+source key for kind-restricted searches).
 *
 * Tools attach per-call inside `streamResponse`'s `thread.streamText(...)`
 * call. The `cloneAgent` singleton in `chat/agent.ts` stays tools-less
 * because it has no per-request `profileOwnerId` to close over.
 *
 * Tool execution runs inside the Convex action (Node runtime). The handler
 * does the server-resolvable part (look up slug, validate ownership,
 * confirm published) and returns a structured result. The client-side
 * watcher reads the tool result from the streamed UIMessage parts and
 * dispatches the actual navigation — this file deliberately does not
 * attempt to navigate, since tools cannot reach the renderer from the
 * server.
 */
export function buildCloneTools(
  profileOwnerId: Id<"users">,
  options: BuildCloneToolsOptions = {},
) {
  const assertOwnerWriteAllowed = () => {
    if (options.viewerId !== profileOwnerId) {
      throw new Error(
        "Only the profile owner can publish, unpublish, or delete content from chat.",
      );
    }
  };

  return {
    getLatestPublished: createTool({
      description:
        "Look up the most recent published article or post for this profile. Use this when the visitor asks for the latest writing of a given kind so you can resolve a slug before navigating.",
      inputSchema: z.object({
        kind: z
          .enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES)
          .describe(
            "Which content kind to look up the latest published item for.",
          ),
      }),
      execute: async (ctx, { kind }) => {
        const row: {
          slug: string;
          title: string;
          publishedAt?: number;
        } | null = await ctx.runQuery(
          internal.chat.toolQueries.queryLatestPublished,
          { userId: profileOwnerId, kind },
        );
        return row;
      },
    }),

    findRelevantPublishedContent: createTool({
      description:
        "Search this profile owner's published articles and posts by semantic relevance to the visitor's question. Use this for topical, project, article, or 'what is X?' questions before saying there is no matching article or post. Returns canonical kind, slug, title, href, excerpt, and score; call navigateToContent with the returned kind and slug when the visitor asks to see, show, open, or read the relevant source.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            "The visitor's topical question or phrase to search for in published content.",
          ),
        kind: z
          .enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES)
          .optional()
          .describe(
            "Optionally restrict the semantic search to articles or posts.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(RELEVANT_CONTENT_MAX_LIMIT)
          .optional()
          .describe(
            `Maximum number of relevant results to return, capped at ${RELEVANT_CONTENT_MAX_LIMIT}.`,
          ),
      }),
      execute: async (ctx, { query, kind, limit }) => {
        return await findRelevantPublishedContent(
          ctx as RelevantContentSearchCtx,
          {
            profileOwnerId,
            query,
            kind,
            limit,
          },
        );
      },
    }),

    navigateToContent: createTool({
      description:
        "Open an article or post in the visitor's right panel. Pass the kind and slug; do not pass any user identifier. The slug must come from getLatestPublished, findRelevantPublishedContent, or from content the profile owner has authored. The result includes the canonical href; the client uses it to navigate.",
      inputSchema: z.object({
        kind: z
          .enum(NAVIGABLE_CONTENT_KIND_ENUM_VALUES)
          .describe("Which content kind to open."),
        slug: z
          .string()
          .min(1)
          .describe("The slug of the article or post to open."),
      }),
      execute: async (ctx, { kind, slug }) => {
        // The href shape is built server-side in `resolveBySlug` (via
        // `buildContentHref`) so a single source of truth covers both the
        // tool path and any future caller. We pass through the structured
        // result; the client-side intent watcher reads `href` and routes.
        const row: {
          kind: ContentKind;
          slug: string;
          title: string;
          publishedAt?: number;
          username: string;
          href: string;
        } | null = await ctx.runQuery(internal.chat.toolQueries.resolveBySlug, {
          userId: profileOwnerId,
          kind,
          slug,
        });
        if (!row) {
          const source = getNavigableContentSource(kind);
          throw new Error(
            `No published ${source.label.singular} found for slug "${slug}".`,
          );
        }
        return {
          kind: row.kind,
          slug: row.slug,
          title: row.title,
          href: row.href,
        };
      },
    }),

    editPost: createTool({
      description:
        "Open the editor for one of the profile owner's posts by slug. Use this only when the visitor (who must be the profile owner) explicitly asks to edit or open the editor for a specific post. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The slug must come from getLatestPublished or from a post the profile owner has authored. The result includes the canonical editHref; the client uses it to navigate the owner to the inline editor.",
      // The LLM-visible surface is `slug` only. The owner is the closure-bound
      // `profileOwnerId`, never a tool arg — same cross-user isolation boundary
      // as `navigateToContent` and `deletePost`. The `inputSchema invariants`
      // tests in `chat/__tests__/tools.test.ts` pin this.
      inputSchema: z.object({
        slug: z
          .string()
          .min(1)
          .describe("The slug of the post to open in the editor."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const row: {
          kind: ContentKind;
          slug: string;
          title: string;
          status: ContentStatus;
          publishedAt?: number;
          username: string;
          href: string;
        } | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveOwnedContentBySlug,
          { userId: profileOwnerId, kind: "posts", slug },
        );
        if (!row) {
          throw new Error(
            `No post found for slug "${slug}" owned by this profile.`,
          );
        }

        const editHref = `${row.href}/edit`;
        return {
          kind: "posts" as const,
          slug: row.slug,
          title: row.title,
          status: row.status,
          editHref,
        };
      },
    }),

        deletePost: createTool({
      description:
        "Permanently delete one of the profile owner's posts by slug. Use this only when the visitor (who is the profile owner — verify by their phrasing such as 'delete my post titled X') explicitly asks to remove a post. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The slug must come from getLatestPublished or from a post the profile owner has authored. The result includes a `deleted` boolean and the canonical posts-list href; the client uses the href to navigate the visitor away from the now-deleted detail page. If `deleted` is false the slug did not match a post owned by this profile — acknowledge the miss and offer to look it up with getLatestPublished.",
      // The LLM-visible surface is `slug` only. The owner is the closure-bound
      // `profileOwnerId`, never a tool arg — same cross-user isolation
      // boundary `navigateToContent` and `openProfileSection` enforce. The
      // `inputSchema invariants` tests in `chat/__tests__/tools.test.ts` pin
      // this.
      inputSchema: z.object({
        slug: z
          .string()
          .min(1)
          .describe("The slug of the post to permanently delete."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const result: {
          deleted: boolean;
          title?: string;
          slug: string;
        } = await ctx.runMutation(
          internal.posts.mutations.deleteByUserAndSlug,
          { userId: profileOwnerId, slug },
        );

        // Resolve the posts-list href once on the server (same single source
        // of truth `openProfileSection` uses for `section: "posts"`). The
        // client-side intent watcher passes this through `buildChatAwareHref`
        // — never recomposing the URL template.
        const list: {
          kind: ContentKind;
          username: string;
          href: string;
          hasEntries: boolean;
        } | null = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileSectionList,
          { userId: profileOwnerId, section: "posts" },
        );
        if (!list) {
          // The owner row is missing or has no username. The delete may have
          // already succeeded (cross-user isolation is enforced by
          // `deleteByUserAndSlug` regardless), but we cannot produce a valid
          // post-list href to navigate the visitor to. Mirror the
          // null-row pattern in `openProfileSection`.
          throw new Error("Posts list is unavailable for this profile.");
        }

        return {
          kind: "posts" as const,
          deleted: result.deleted,
          slug: result.slug,
          title: result.title,
          href: list.href,
        };
      },
    }),

    publishPost: createTool({
      description:
        "Publish one of the profile owner's draft posts by slug. Use this only when the visitor is the profile owner and explicitly asks to publish a post. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The result includes whether a post was updated and the canonical href; on success the client navigates to the published post detail page.",
      inputSchema: z.object({
        slug: z.string().min(1).describe("The slug of the post to publish."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const row: OwnedContentRow | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveOwnedContentBySlug,
          { userId: profileOwnerId, kind: "posts", slug },
        );
        if (!row) {
          const list: ProfileSectionList | null = await ctx.runQuery(
            internal.chat.toolQueries.queryProfileSectionList,
            { userId: profileOwnerId, section: "posts" },
          );
          if (!list) {
            throw new Error("Posts list is unavailable for this profile.");
          }
          return {
            kind: "posts" as const,
            status: "published" as const,
            updated: false,
            changed: false,
            slug,
            href: list.href,
          };
        }

        const result: StatusMutationResult = await ctx.runMutation(
          internal.chat.toolMutations.setPostStatusByUserAndSlug,
          { userId: profileOwnerId, slug, status: "published" },
        );
        const list: ProfileSectionList | null = result.updated
          ? null
          : await ctx.runQuery(
              internal.chat.toolQueries.queryProfileSectionList,
              { userId: profileOwnerId, section: "posts" },
            );
        if (!result.updated && !list) {
          throw new Error("Posts list is unavailable for this profile.");
        }
        return {
          kind: "posts" as const,
          status: "published" as const,
          updated: result.updated,
          changed: result.updated ? result.changed : false,
          slug: result.slug,
          title: result.updated ? result.title : row.title,
          href: result.updated ? row.href : list!.href,
        };
      },
    }),

    unpublishPost: createTool({
      description:
        "Unpublish one of the profile owner's posts by slug, moving it back to draft. Use this only when the visitor is the profile owner and explicitly asks to unpublish a post. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The result includes whether a post was updated and the canonical posts-list href; the client uses the href to navigate away from the unpublished detail page.",
      inputSchema: z.object({
        slug: z.string().min(1).describe("The slug of the post to unpublish."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const row: OwnedContentRow | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveOwnedContentBySlug,
          { userId: profileOwnerId, kind: "posts", slug },
        );
        if (!row) {
          const list: ProfileSectionList | null = await ctx.runQuery(
            internal.chat.toolQueries.queryProfileSectionList,
            { userId: profileOwnerId, section: "posts" },
          );
          if (!list) {
            throw new Error("Posts list is unavailable for this profile.");
          }
          return {
            kind: "posts" as const,
            status: "draft" as const,
            updated: false,
            changed: false,
            slug,
            href: list.href,
          };
        }

        const result: StatusMutationResult = await ctx.runMutation(
          internal.chat.toolMutations.setPostStatusByUserAndSlug,
          { userId: profileOwnerId, slug, status: "draft" },
        );
        const list: ProfileSectionList | null = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileSectionList,
          { userId: profileOwnerId, section: "posts" },
        );
        if (!list) {
          throw new Error("Posts list is unavailable for this profile.");
        }
        return {
          kind: "posts" as const,
          status: "draft" as const,
          updated: result.updated,
          changed: result.updated ? result.changed : false,
          slug: result.slug,
          title: result.updated ? result.title : row.title,
          href: list.href,
        };
      },
    }),

    deleteArticle: createTool({
      description:
        "Permanently delete one of the profile owner's articles by slug. Use this only when the visitor (who must be the profile owner) explicitly asks to remove an article. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The result includes a `deleted` boolean and the canonical articles-list href; the client uses the href to navigate the visitor away from the now-deleted detail page.",
      inputSchema: z.object({
        slug: z
          .string()
          .min(1)
          .describe("The slug of the article to permanently delete."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const row: OwnedContentRow | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveOwnedContentBySlug,
          { userId: profileOwnerId, kind: "articles", slug },
        );
        if (!row) {
          const list: ProfileSectionList | null = await ctx.runQuery(
            internal.chat.toolQueries.queryProfileSectionList,
            { userId: profileOwnerId, section: "articles" },
          );
          if (!list) {
            throw new Error("Articles list is unavailable for this profile.");
          }
          return {
            kind: "articles" as const,
            deleted: false,
            slug,
            href: list.href,
          };
        }

        const result: {
          deleted: boolean;
          title?: string;
          slug: string;
        } = await ctx.runMutation(
          internal.chat.toolMutations.deleteArticleByUserAndSlug,
          { userId: profileOwnerId, slug },
        );
        const list: ProfileSectionList | null = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileSectionList,
          { userId: profileOwnerId, section: "articles" },
        );
        if (!list) {
          throw new Error("Articles list is unavailable for this profile.");
        }
        return {
          kind: "articles" as const,
          deleted: result.deleted,
          slug: result.slug,
          title: result.title ?? row.title,
          href: list.href,
        };
      },
    }),

    publishArticle: createTool({
      description:
        "Publish one of the profile owner's draft articles by slug. Use this only when the visitor is the profile owner and explicitly asks to publish an article. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The result includes whether an article was updated and the canonical href; on success the client navigates to the published article detail page.",
      inputSchema: z.object({
        slug: z.string().min(1).describe("The slug of the article to publish."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const row: OwnedContentRow | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveOwnedContentBySlug,
          { userId: profileOwnerId, kind: "articles", slug },
        );
        if (!row) {
          const list: ProfileSectionList | null = await ctx.runQuery(
            internal.chat.toolQueries.queryProfileSectionList,
            { userId: profileOwnerId, section: "articles" },
          );
          if (!list) {
            throw new Error("Articles list is unavailable for this profile.");
          }
          return {
            kind: "articles" as const,
            status: "published" as const,
            updated: false,
            changed: false,
            slug,
            href: list.href,
          };
        }

        const result: StatusMutationResult = await ctx.runMutation(
          internal.chat.toolMutations.setArticleStatusByUserAndSlug,
          { userId: profileOwnerId, slug, status: "published" },
        );
        const list: ProfileSectionList | null = result.updated
          ? null
          : await ctx.runQuery(
              internal.chat.toolQueries.queryProfileSectionList,
              { userId: profileOwnerId, section: "articles" },
            );
        if (!result.updated && !list) {
          throw new Error("Articles list is unavailable for this profile.");
        }
        return {
          kind: "articles" as const,
          status: "published" as const,
          updated: result.updated,
          changed: result.updated ? result.changed : false,
          slug: result.slug,
          title: result.updated ? result.title : row.title,
          href: result.updated ? row.href : list!.href,
        };
      },
    }),

    unpublishArticle: createTool({
      description:
        "Unpublish one of the profile owner's articles by slug, moving it back to draft. Use this only when the visitor is the profile owner and explicitly asks to unpublish an article. Pass the slug only — the owner is resolved server-side from the chat context, do not pass any user identifier. The result includes whether an article was updated and the canonical articles-list href; the client uses the href to navigate away from the unpublished detail page.",
      inputSchema: z.object({
        slug: z
          .string()
          .min(1)
          .describe("The slug of the article to unpublish."),
      }),
      execute: async (ctx, { slug }) => {
        assertOwnerWriteAllowed();

        const row: OwnedContentRow | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveOwnedContentBySlug,
          { userId: profileOwnerId, kind: "articles", slug },
        );
        if (!row) {
          const list: ProfileSectionList | null = await ctx.runQuery(
            internal.chat.toolQueries.queryProfileSectionList,
            { userId: profileOwnerId, section: "articles" },
          );
          if (!list) {
            throw new Error("Articles list is unavailable for this profile.");
          }
          return {
            kind: "articles" as const,
            status: "draft" as const,
            updated: false,
            changed: false,
            slug,
            href: list.href,
          };
        }

        const result: StatusMutationResult = await ctx.runMutation(
          internal.chat.toolMutations.setArticleStatusByUserAndSlug,
          { userId: profileOwnerId, slug, status: "draft" },
        );
        const list: ProfileSectionList | null = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileSectionList,
          { userId: profileOwnerId, section: "articles" },
        );
        if (!list) {
          throw new Error("Articles list is unavailable for this profile.");
        }
        return {
          kind: "articles" as const,
          status: "draft" as const,
          updated: result.updated,
          changed: result.updated ? result.changed : false,
          slug: result.slug,
          title: result.updated ? result.title : row.title,
          href: list.href,
        };
      },
    }),

    openProfileSection: createTool({
      description:
        "Open one of the profile owner's tab panels for the visitor. Pass section: 'bio' to open the bio panel — the structured work history, education, and professional background. Pass section: 'contact' to open the contact panel — the profile owner's email and social profile links (LinkedIn, Instagram, X, TikTok, YouTube). Pass section: 'projects' to open the projects panel — projects the profile owner has worked on or is working on. Pass section: 'articles' or 'posts' to open the visitor's list view of all published articles or posts (use this for list-level requests like 'show me your articles', not for opening a specific item — for that, call findRelevantPublishedContent or getLatestPublished, then navigateToContent). The owner is resolved server-side from the chat context — do not pass any user identifier. The result includes the canonical href (the client uses it to navigate) and a hasEntries boolean — when hasEntries is false, briefly acknowledge that the section is currently empty before opening it.",
      // The LLM-visible surface is `section` only. The owner is the
      // closure-bound `profileOwnerId`, never a tool arg. The
      // `inputSchema invariants` tests in `chat/__tests__/tools.test.ts`
      // pin this. `clone-settings` is intentionally excluded — it is
      // owner-only and not a visitor-reachable view.
      inputSchema: z.object({
        section: z
          .enum(["bio", "contact", "projects", "articles", "posts"])
          .describe(
            "Which profile section to open — 'bio', 'contact', 'projects', 'articles' (list view), or 'posts' (list view).",
          ),
      }),
      execute: async (ctx, { section }) => {
        if (section === "bio") {
          const row: {
            username: string;
            href: string;
            hasEntries: boolean;
          } | null = await ctx.runQuery(
            internal.chat.toolQueries.queryBioPanel,
            { userId: profileOwnerId },
          );
          if (!row) {
            // Mirrors `navigateToContent`'s "no row" path — surfaces a tool
            // error so the LLM falls back to text. This branch only fires
            // when the owner has no `username` (rare, but defensible: a row
            // with no username can't produce `/@<username>/bio`).
            throw new Error("Bio panel is unavailable for this profile.");
          }
          return {
            kind: "bio" as const,
            href: row.href,
            hasEntries: row.hasEntries,
          };
        }

        if (section === "contact") {
          const row: {
            username: string;
            href: string;
            hasEntries: boolean;
          } | null = await ctx.runQuery(
            internal.chat.toolQueries.queryContactPanel,
            { userId: profileOwnerId },
          );
          if (!row) {
            throw new Error("Contact panel is unavailable for this profile.");
          }
          return {
            kind: "contact" as const,
            href: row.href,
            hasEntries: row.hasEntries,
          };
        }

        if (section === "projects") {
          const row: {
            username: string;
            href: string;
            hasEntries: boolean;
          } | null = await ctx.runQuery(
            internal.chat.toolQueries.queryProjectsPanel,
            { userId: profileOwnerId },
          );
          if (!row) {
            throw new Error("Projects panel is unavailable for this profile.");
          }
          return {
            kind: "projects" as const,
            href: row.href,
            hasEntries: row.hasEntries,
          };
        }

        const row: {
          kind: ContentKind;
          username: string;
          href: string;
          hasEntries: boolean;
        } | null = await ctx.runQuery(
          internal.chat.toolQueries.queryProfileSectionList,
          { userId: profileOwnerId, section },
        );
        if (!row) {
          throw new Error(
            `${section === "articles" ? "Articles" : "Posts"} list is unavailable for this profile.`,
          );
        }
        return {
          kind: row.kind,
          href: row.href,
          hasEntries: row.hasEntries,
        };
      },
    }),
  };
}
