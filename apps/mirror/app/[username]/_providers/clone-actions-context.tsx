"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { getContentHref, type ContentKind } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useProfileRouteData } from "./profile-route-data-context";

/**
 * Single dispatcher for clone-level actions.
 *
 * Both routes — the user's own UI clicks (article/post list items) and the
 * agent's tool-result watcher (`useAgentIntentWatcher`) — funnel through
 * the same `useCloneActions().navigateToContent(...)` call. There is no
 * agent-only navigation path, which keeps the agent honest: it cannot
 * fire-and-forget invisible navigation, and any future confirmation,
 * audit, or UI affordance attaches in one place.
 *
 * The agent path passes a server-built `href` (returned from the
 * `navigateToContent` tool's structured result) directly so the client
 * never recomposes the URL template — the server is the source of truth
 * for the canonical href shape. The user-UI path omits `href` and the
 * dispatcher composes it from `username + kind + slug`.
 *
 * `buildChatAwareHref` preserves the chat query params (`?chat=1&conversation=...`)
 * across navigation, mirroring the current `<Link>` semantics in both
 * list items.
 */
type CloneActions = {
  navigateToContent: (args: {
    kind: ContentKind;
    slug: string;
    /**
     * Optional override — when called from the agent intent watcher,
     * pass the server-built href directly instead of recomposing
     * client-side. The user-UI path omits this and the dispatcher
     * builds the href from `username + kind + slug`.
     */
    href?: string;
  }) => void;
};

const CloneActionsContext = createContext<CloneActions | null>(null);

export function useCloneActions() {
  const ctx = useContext(CloneActionsContext);
  if (!ctx) {
    throw new Error(
      "useCloneActions must be used within CloneActionsProvider",
    );
  }
  return ctx;
}

type CloneActionsProviderProps = {
  children: ReactNode;
};

export function CloneActionsProvider({ children }: CloneActionsProviderProps) {
  const router = useRouter();
  const { profile } = useProfileRouteData();
  const { buildChatAwareHref } = useChatSearchParams();

  const navigateToContent = useCallback<CloneActions["navigateToContent"]>(
    ({ kind, slug, href }) => {
      // Agent path: server provided the canonical href; do NOT recompose.
      // User path: build from username + kind + slug.
      const basePath = href ?? getContentHref(profile.username, kind, slug);
      router.push(buildChatAwareHref(basePath), { scroll: false });
    },
    [router, profile.username, buildChatAwareHref],
  );

  const value = useMemo<CloneActions>(
    () => ({ navigateToContent }),
    [navigateToContent],
  );

  return (
    <CloneActionsContext.Provider value={value}>
      {children}
    </CloneActionsContext.Provider>
  );
}
