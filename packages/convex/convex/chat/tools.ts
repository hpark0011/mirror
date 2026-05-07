"use node";

import { z } from "zod";
import { createTool } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import { type Id } from "../_generated/dataModel";

/**
 * Per-request tool factory for the clone agent.
 *
 * The factory closes over `profileOwnerId` so the LLM can never pass a
 * different user's id through tool arguments. The `inputSchema` of every
 * tool here MUST NOT include a `userId` field — the cross-user isolation
 * boundary is the same one the RAG side uses (`vectorSearch.filter` keyed
 * on `profileOwnerId`).
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
export function buildCloneTools(profileOwnerId: Id<"users">) {
  return {
    getLatestPublished: createTool({
      description:
        "Look up the most recent published article or post for this profile. Use this when the visitor asks for the latest writing of a given kind so you can resolve a slug before navigating.",
      inputSchema: z.object({
        kind: z
          .enum(["articles", "posts"])
          .describe("Which content kind to look up the latest published item for."),
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

    navigateToContent: createTool({
      description:
        "Open an article or post in the visitor's right panel. Pass the kind and slug; do not pass any user identifier. The slug must come from getLatestPublished or from content the profile owner has authored. The result includes the canonical href; the client uses it to navigate.",
      inputSchema: z.object({
        kind: z
          .enum(["articles", "posts"])
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
          kind: "articles" | "posts";
          slug: string;
          title: string;
          publishedAt?: number;
          username: string;
          href: string;
        } | null = await ctx.runQuery(
          internal.chat.toolQueries.resolveBySlug,
          { userId: profileOwnerId, kind, slug },
        );
        if (!row) {
          throw new Error(
            `No published ${kind === "articles" ? "article" : "post"} found for slug "${slug}".`,
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

    openProfileSection: createTool({
      description:
        "Open one of the profile owner's tab panels for the visitor. Pass section: 'bio' to open the bio panel — the structured work history, education, and professional background. Pass section: 'articles' or 'posts' to open the visitor's list view of all published articles or posts (use this for list-level requests like 'show me your articles', not for opening a specific item — for that, call getLatestPublished + navigateToContent instead). The owner is resolved server-side from the chat context — do not pass any user identifier. The result includes the canonical href (the client uses it to navigate) and a hasEntries boolean — when hasEntries is false, briefly acknowledge that the section is currently empty before opening it.",
      // The LLM-visible surface is `section` only. The owner is the
      // closure-bound `profileOwnerId`, never a tool arg. The
      // `inputSchema invariants` tests in `chat/__tests__/tools.test.ts`
      // pin this. `clone-settings` is intentionally excluded — it is
      // owner-only and not a visitor-reachable view.
      inputSchema: z.object({
        section: z
          .enum(["bio", "articles", "posts"])
          .describe(
            "Which profile section to open — 'bio', 'articles' (list view), or 'posts' (list view).",
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

        const row: {
          kind: "articles" | "posts";
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
