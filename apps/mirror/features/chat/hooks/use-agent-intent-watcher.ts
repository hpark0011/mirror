"use client";

import { useEffect } from "react";
import type { UIMessage } from "@convex-dev/agent/react";
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
    typeof o.slug === "string" && o.slug.length > 0 &&
    typeof o.title === "string" &&
    typeof o.href === "string" && o.href.length > 0 &&
    isContentKind(typeof o.kind === "string" ? o.kind : undefined)
  );
}

type OpenProfileSectionOutput = {
  // The agent's `openProfileSection` enum is the visitor-visible subset of
  // `ProfileTabKind` — `clone-settings` is owner-only and is never returned
  // by the tool.
  kind: "bio" | "articles" | "posts";
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

export function useAgentIntentWatcher(
  messages: UIMessage[],
  conversationId: string | null,
) {
  const { navigateToContent, navigateToProfileSection } = useCloneActions();

  useEffect(() => {
    if (messages.length === 0) return;

    const handled = getHandledSet(conversationId);

    // Walk the assistant messages in order; tool calls can land in any
    // assistant message and the order is preserved by `combineUIMessages`.
    // We skip user messages — only assistant messages carry tool parts.
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (
          part.type !== NAVIGATE_TO_CONTENT_TYPE &&
          part.type !== OPEN_PROFILE_SECTION_TYPE
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
      }
    }
  }, [messages, navigateToContent, navigateToProfileSection, conversationId]);
}
