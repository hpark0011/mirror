"use node";

import { z } from "zod";
import { createTool } from "@convex-dev/agent";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

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
  };
}
