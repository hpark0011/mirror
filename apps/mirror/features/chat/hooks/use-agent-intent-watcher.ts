"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "@convex-dev/agent/react";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { isContentKind, type ContentKind } from "@/features/content";

/**
 * Watches incoming `UIMessage[]` for completed `navigateToContent` tool
 * results and dispatches them through the same `useCloneActions` hook the
 * user-UI list items call. This is the agent half of the
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
 * Idempotency: `handledToolCallIds` tracks the toolCallIds we've already
 * dispatched. The same UIMessage re-renders many times during streaming
 * and after persistence; without this ref, we'd navigate on every render
 * the moment a tool result lands.
 *
 * Lifecycle limitation (Phase 1): this hook is mounted only while the
 * chat panel is visible (it lives inside `ChatActiveThread`, which is
 * inside `ChatPanel`, which renders only when `isChatOpen === true`).
 * If the user manually closes the chat panel between when the agent
 * emits a `navigateToContent` tool result and when this watcher
 * processes it, the navigation is dropped. The dominant flow
 * (user asks → agent navigates → chat stays open via `?chat=1`)
 * is unaffected. Phase 2 will move the watcher to a permanent mount
 * with a shared message-state subscription so closing the panel
 * mid-stream no longer drops the navigation.
 */
const NAVIGATE_TO_CONTENT_TYPE = "tool-navigateToContent";

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

export function useAgentIntentWatcher(messages: UIMessage[]) {
  const { navigateToContent } = useCloneActions();
  const handledToolCallIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (messages.length === 0) return;

    // Walk the assistant messages in order; tool calls can land in any
    // assistant message and the order is preserved by `combineUIMessages`.
    // We skip user messages — only assistant messages carry tool parts.
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (part.type !== NAVIGATE_TO_CONTENT_TYPE) continue;
        // Narrow to the tool-result shape — `state` and `toolCallId` are
        // both present on every variant of the tool-part union.
        const toolPart = part as {
          type: string;
          state: string;
          toolCallId: string;
          output?: unknown;
        };
        if (toolPart.state !== "output-available") continue;
        if (handledToolCallIdsRef.current.has(toolPart.toolCallId)) continue;
        if (!isNavigateOutput(toolPart.output)) continue;

        handledToolCallIdsRef.current.add(toolPart.toolCallId);
        navigateToContent({
          kind: toolPart.output.kind,
          slug: toolPart.output.slug,
          // Server-built href — do NOT recompose client-side. The
          // dispatcher passes this through `buildChatAwareHref` to
          // preserve `?chat=1&conversation=...`.
          href: toolPart.output.href,
        });
      }
    }
  }, [messages, navigateToContent]);
}
