"use client";

import { useEffect, useRef } from "react";
import { type UIMessage } from "@convex-dev/agent/react";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { isContentKind, type ContentKind } from "@/features/content";

/**
 * Watches incoming `UIMessage[]` for completed tool results and dispatches
 * them through the same `useCloneActions` hook the user-UI list items and
 * profile tabs call. This is the agent half of the
 * "two routes, one dispatcher" pattern — see
 * `apps/mirror/app/[username]/_providers/clone-actions-context.tsx`.
 *
 * Tool-result part shape (verified against
 * `node_modules/@convex-dev/agent/dist/UIMessages.d.ts` and the AI SDK's
 * `ToolUIPart` in `node_modules/ai/dist/index.d.ts`):
 *
 *   {
 *     type: `tool-${toolName}`,        // e.g. "tool-navigateToContent"
 *     state: "input-streaming" | "input-available" | "output-available" | "output-error",
 *     toolCallId: string,
 *     input: <args>,                    // present after "input-available"
 *     output: <result>,                 // present only when state === "output-available"
 *     errorText?: string,               // present only when state === "output-error"
 *     ...
 *   }
 *
 * We only act on `state === "output-available"` parts so a streaming
 * input doesn't fire navigation prematurely, and an `output-error` is
 * left for the LLM's text recovery.
 *
 * Idempotency is conversation-scoped, not mount-scoped. The
 * `handledByConversation` Map at module scope persists the
 * `Set<toolCallId>` for each conversationId across mounts of the
 * watcher — so closing and reopening the chat panel, switching to an
 * existing conversation, or any future mount migration cannot re-fire
 * a historical tool result that's already been dispatched.
 */
const NAVIGATE_TO_CONTENT_TYPE = "tool-navigateToContent";
const OPEN_PROFILE_SECTION_TYPE = "tool-openProfileSection";
const DELETE_POST_TYPE = "tool-deletePost";
const PUBLISH_POST_TYPE = "tool-publishPost";
const UNPUBLISH_POST_TYPE = "tool-unpublishPost";
const DELETE_ARTICLE_TYPE = "tool-deleteArticle";
const PUBLISH_ARTICLE_TYPE = "tool-publishArticle";
const UNPUBLISH_ARTICLE_TYPE = "tool-unpublishArticle";
const APPLY_BIO_ENTRY_PATCH_TYPE = "tool-applyBioEntryPatch";
const APPLY_CONTACT_ENTRY_PATCH_TYPE = "tool-applyContactEntryPatch";
const APPLY_CONTENT_PATCH_TYPE = "tool-applyContentPatch";

/**
 * Module-level Map of conversationId → set of dispatched toolCallIds.
 *
 * This is a deliberate exception to `.claude/rules/state-management.md`'s
 * three-tier hierarchy (useState → useLocalStorage → React Context).
 * Cross-mount persistence is the requirement: when `ChatActiveThread`
 * unmounts on chat-panel close and remounts on reopen, a per-mount ref
 * loses its handled-toolCallId set and the persisted UIMessages
 * re-dispatch every historical navigation. Module scope outlives mounts
 * (and React Context would re-create the Set on its own provider's
 * unmount), so the Map lives here.
 *
 * Memory bound: each toolCallId is ~36 chars (UUID). 1000 tool calls
 * across all conversations ≈ 36 KB. Acceptable for a tab's lifetime.
 *
 * Exported for unit tests so they can clear it between test cases.
 */
export const handledByConversation = new Map<string, Set<string>>();

function getHandledSet(conversationId: string | null): Set<string> {
  // Treat a null conversationId (a brand-new thread the user hasn't sent
  // a message in yet) as its own bucket. The first send creates the
  // conversation row and the next render flips this to a real id; any
  // toolCallIds collected under "null" are functionally orphaned because
  // the watcher won't see them again — that's fine.
  const key = conversationId ?? "__null__";
  let set = handledByConversation.get(key);
  if (!set) {
    set = new Set<string>();
    handledByConversation.set(key, set);
  }
  return set;
}

type NavigateOutput = {
  kind: ContentKind;
  slug: string;
  title: string;
  href: string;
};

function isNavigateOutput(output: unknown): output is NavigateOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    typeof o.slug === "string" &&
    o.slug.length > 0 &&
    typeof o.title === "string" &&
    typeof o.href === "string" &&
    o.href.length > 0 &&
    isContentKind(typeof o.kind === "string" ? o.kind : undefined)
  );
}

type OpenProfileSectionOutput = {
  // The agent's `openProfileSection` enum is the visitor-visible subset of
  // `ProfileTabKind` — `clone-settings` is owner-only and is never returned
  // by the tool.
  kind: "bio" | "contact" | "articles" | "posts";
  href: string;
  // Emitted by the `openProfileSection` tool so a future caller (a richer
  // dispatcher or a connector reading the dispatched intent) can phrase
  // "the section is currently empty" instead of opening a panel without
  // acknowledgement. The watcher itself does not consume this today;
  // typing it keeps the client narrowing aligned with the tool's actual
  // return shape.
  hasEntries: boolean;
};

function isOpenProfileSectionOutput(
  output: unknown,
): output is OpenProfileSectionOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  if (
    o.kind !== "bio" &&
    o.kind !== "contact" &&
    o.kind !== "articles" &&
    o.kind !== "posts"
  ) {
    return false;
  }
  return (
    typeof o.href === "string" &&
    o.href.length > 0 &&
    typeof o.hasEntries === "boolean"
  );
}

type DeletePostOutput = {
  // The agent's `deletePost` tool result mirrors `openProfileSection`'s
  // section-level navigation contract: a server-built href pointing at the
  // posts-list route the visitor should land on after the post they were
  // viewing was removed. Slug-level navigation (`navigateToContent`) is the
  // wrong shape here — the post is gone, so its detail href would 404.
  kind: "posts";
  // Whether the server actually deleted a row. False when the slug did not
  // match a post owned by this profile (stale slug, hallucination,
  // already-deleted). The watcher still navigates because the user-visible
  // expectation ("take me to the posts list") holds either way — and
  // navigating away from a possibly-stale detail page is the safe move.
  deleted: boolean;
  slug: string;
  href: string;
};

function isDeletePostOutput(output: unknown): output is DeletePostOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    o.kind === "posts" &&
    typeof o.deleted === "boolean" &&
    typeof o.slug === "string" &&
    typeof o.href === "string" &&
    o.href.length > 0
  );
}

type StatusToolOutput = {
  kind: ContentKind;
  status: "draft" | "published";
  updated: boolean;
  changed: boolean;
  slug: string;
  title?: string;
  href: string;
};

function isStatusToolOutput(output: unknown): output is StatusToolOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    isContentKind(typeof o.kind === "string" ? o.kind : undefined) &&
    (o.status === "draft" || o.status === "published") &&
    typeof o.updated === "boolean" &&
    typeof o.changed === "boolean" &&
    typeof o.slug === "string" &&
    o.slug.length > 0 &&
    typeof o.href === "string" &&
    o.href.length > 0 &&
    (o.title === undefined || typeof o.title === "string")
  );
}

type DeleteArticleOutput = {
  kind: "articles";
  deleted: boolean;
  slug: string;
  title?: string;
  href: string;
};

function isDeleteArticleOutput(output: unknown): output is DeleteArticleOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  return (
    o.kind === "articles" &&
    typeof o.deleted === "boolean" &&
    typeof o.slug === "string" &&
    typeof o.href === "string" &&
    o.href.length > 0 &&
    (o.title === undefined || typeof o.title === "string")
  );
}

type ConfigurationPatchOutput = {
  section: "bio" | "contact";
  href: string;
  applied: Record<string, number>;
};

function isConfigurationPatchOutput(
  output: unknown,
): output is ConfigurationPatchOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  if (o.section !== "bio" && o.section !== "contact") return false;
  if (typeof o.href !== "string" || o.href.length === 0) return false;
  if (!o.applied || typeof o.applied !== "object") return false;
  const applied = o.applied as Record<string, unknown>;
  if (o.section === "bio") {
    return (
      typeof applied.created === "number" &&
      typeof applied.updated === "number" &&
      typeof applied.deleted === "number"
    );
  }
  return (
    typeof applied.upserted === "number" && typeof applied.deleted === "number"
  );
}

// PLAN_013: result shape returned by the configuration agent's
// `applyContentPatch` tool. `lastTouched` is the most recent create/update —
// the watcher uses it to route the owner to the editor (drafts) or detail
// page (published) for review. `lastDeleted` is the most recent delete —
// the watcher uses it to route to the section list when no create/update
// happened in the same patch.
type ContentPatchOutput = {
  applied: { created: number; updated: number; deleted: number };
  lastTouched: {
    kind: ContentKind;
    slug: string;
    status: "draft" | "published";
    href: string;
    editHref: string;
    action: "create" | "update";
  } | null;
  lastDeleted: {
    kind: ContentKind;
    slug: string;
    href: string;
  } | null;
};

function isContentPatchOutput(output: unknown): output is ContentPatchOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  if (!o.applied || typeof o.applied !== "object") return false;
  const applied = o.applied as Record<string, unknown>;
  if (
    typeof applied.created !== "number" ||
    typeof applied.updated !== "number" ||
    typeof applied.deleted !== "number"
  ) {
    return false;
  }
  if (o.lastTouched !== null) {
    if (!o.lastTouched || typeof o.lastTouched !== "object") return false;
    const lt = o.lastTouched as Record<string, unknown>;
    if (
      !isContentKind(typeof lt.kind === "string" ? lt.kind : undefined) ||
      typeof lt.slug !== "string" ||
      lt.slug.length === 0 ||
      (lt.status !== "draft" && lt.status !== "published") ||
      typeof lt.href !== "string" ||
      lt.href.length === 0 ||
      typeof lt.editHref !== "string" ||
      lt.editHref.length === 0 ||
      (lt.action !== "create" && lt.action !== "update")
    ) {
      return false;
    }
  }
  if (o.lastDeleted !== null) {
    if (!o.lastDeleted || typeof o.lastDeleted !== "object") return false;
    const ld = o.lastDeleted as Record<string, unknown>;
    if (
      !isContentKind(typeof ld.kind === "string" ? ld.kind : undefined) ||
      typeof ld.slug !== "string" ||
      typeof ld.href !== "string" ||
      ld.href.length === 0
    ) {
      return false;
    }
  }
  return true;
}

function isPublishToolType(type: string): boolean {
  return type === PUBLISH_POST_TYPE || type === PUBLISH_ARTICLE_TYPE;
}

function isUnpublishToolType(type: string): boolean {
  return type === UNPUBLISH_POST_TYPE || type === UNPUBLISH_ARTICLE_TYPE;
}

export function useAgentIntentWatcher(
  messages: UIMessage[],
  conversationId: string | null,
) {
  const { navigateToContent, navigateToProfileSection } = useCloneActions();

  /**
   * Per-mount perf optimization: track the highest message index already
   * scanned for each conversationId so each effect run only walks new
   * messages. This is layered on top of `handledByConversation`, which
   * remains the cross-mount idempotency authority.
   *
   * Key: conversationId ?? "__null__" (mirrors `getHandledSet`'s key scheme).
   * Value: the `messages.length` at the end of the last scan for that id.
   *
   * Reset condition: if `messages.length` is less than the stored index, the
   * array shrank (remount / new conversation on same key) — fall back to a
   * full scan from index 0 and update the stored index afterwards.
   */
  const lastScannedIndexRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (messages.length === 0) return;

    const handled = getHandledSet(conversationId);
    const idxKey = conversationId ?? "__null__";
    const storedIndex = lastScannedIndexRef.current.get(idxKey) ?? 0;

    // Guard: if messages shrank (unlikely but possible on remount / id reuse),
    // treat as a reset and scan from the beginning.
    const startIndex =
      messages.length < storedIndex ? 0 : storedIndex;

    // Walk the assistant messages in order; tool calls can land in any
    // assistant message and the order is preserved by `combineUIMessages`.
    // We skip user messages — only assistant messages carry tool parts.
    for (let i = startIndex; i < messages.length; i++) {
      const message = messages[i];
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (
          part.type !== NAVIGATE_TO_CONTENT_TYPE &&
          part.type !== OPEN_PROFILE_SECTION_TYPE &&
          part.type !== DELETE_POST_TYPE &&
          part.type !== PUBLISH_POST_TYPE &&
          part.type !== UNPUBLISH_POST_TYPE &&
          part.type !== DELETE_ARTICLE_TYPE &&
          part.type !== PUBLISH_ARTICLE_TYPE &&
          part.type !== UNPUBLISH_ARTICLE_TYPE &&
          part.type !== APPLY_BIO_ENTRY_PATCH_TYPE &&
          part.type !== APPLY_CONTACT_ENTRY_PATCH_TYPE &&
          part.type !== APPLY_CONTENT_PATCH_TYPE
        ) {
          continue;
        }
        // Narrow to the tool-result shape — `state` and `toolCallId` are
        // both present on every variant of the tool-part union.
        const toolPart = part as {
          type: string;
          state: string;
          toolCallId: string;
          output?: unknown;
        };
        if (toolPart.state !== "output-available") continue;
        if (handled.has(toolPart.toolCallId)) continue;

        if (toolPart.type === NAVIGATE_TO_CONTENT_TYPE) {
          if (!isNavigateOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);
          navigateToContent({
            kind: toolPart.output.kind,
            slug: toolPart.output.slug,
            // Server-built href — do NOT recompose client-side. The
            // dispatcher passes this through `buildChatAwareHref` to
            // preserve `?chat=1&conversation=...`.
            href: toolPart.output.href,
          });
          continue;
        }

        if (toolPart.type === OPEN_PROFILE_SECTION_TYPE) {
          if (!isOpenProfileSectionOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);
          navigateToProfileSection({
            section: toolPart.output.kind,
            href: toolPart.output.href,
          });
          continue;
        }

        if (isPublishToolType(toolPart.type)) {
          if (!isStatusToolOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);

          if (toolPart.output.updated) {
            navigateToContent({
              kind: toolPart.output.kind,
              slug: toolPart.output.slug,
              href: toolPart.output.href,
            });
          } else {
            navigateToProfileSection({
              section: toolPart.output.kind,
              href: toolPart.output.href,
            });
          }
          continue;
        }

        if (isUnpublishToolType(toolPart.type)) {
          if (!isStatusToolOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);
          navigateToProfileSection({
            section: toolPart.output.kind,
            href: toolPart.output.href,
          });
          continue;
        }

        if (toolPart.type === DELETE_ARTICLE_TYPE) {
          if (!isDeleteArticleOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);
          navigateToProfileSection({
            section: toolPart.output.kind,
            href: toolPart.output.href,
          });
          continue;
        }

        if (toolPart.type === DELETE_POST_TYPE) {
          if (!isDeletePostOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);
          // Tab-level navigation (server-built href). The deletion already
          // happened server-side via `internal.posts.mutations.deleteByUserAndSlug`;
          // the only client-side responsibility is moving the visitor off the
          // possibly-stale detail page. Funnels through the same dispatcher
          // the user-UI delete flow would route to (`router.replace` to the
          // posts list) — see `apps/mirror/features/posts/hooks/use-delete-post.ts`.
          navigateToProfileSection({
            section: toolPart.output.kind,
            href: toolPart.output.href,
          });
          continue;
        }

        if (
          toolPart.type === APPLY_BIO_ENTRY_PATCH_TYPE ||
          toolPart.type === APPLY_CONTACT_ENTRY_PATCH_TYPE
        ) {
          if (!isConfigurationPatchOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);
          navigateToProfileSection({
            section: toolPart.output.section,
            href: toolPart.output.href,
          });
          continue;
        }

        if (toolPart.type === APPLY_CONTENT_PATCH_TYPE) {
          if (!isContentPatchOutput(toolPart.output)) continue;
          handled.add(toolPart.toolCallId);

          // Routing rules for the configuration agent's content patch:
          //   - If the patch created/updated a row, route to that row.
          //     Drafts land on the edit route so the owner can review the
          //     generated content before publishing; published rows land
          //     on the public detail page.
          //   - Otherwise, if the patch deleted a row, route to the section
          //     list so the owner doesn't sit on a now-404 detail page.
          //   - Otherwise (no rows touched — shouldn't happen, but the
          //     server returns success on missing-slug deletes), no-op.
          const { lastTouched, lastDeleted } = toolPart.output;
          if (lastTouched) {
            navigateToContent({
              kind: lastTouched.kind,
              slug: lastTouched.slug,
              href:
                lastTouched.status === "draft"
                  ? lastTouched.editHref
                  : lastTouched.href,
            });
            continue;
          }
          if (lastDeleted) {
            navigateToProfileSection({
              section: lastDeleted.kind,
              href: lastDeleted.href,
            });
          }
          continue;
        }
      }
    }

    // Update the last-scanned index so the next effect run starts from here.
    lastScannedIndexRef.current.set(idxKey, messages.length);
  }, [messages, navigateToContent, navigateToProfileSection, conversationId]);
}
