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
import {
  getProfileTabHref,
  type ProfileTabKind,
} from "@/features/profile-tabs/types";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useProfileRouteData } from "./profile-route-data-context";
import { useWorkspacePanelBridge } from "./workspace-panel-bridge-context";

/**
 * Single dispatcher for clone-level actions.
 *
 * Both routes — the user's own UI clicks (article/post list items, profile
 * tabs) and the agent's tool-result watcher (`useAgentIntentWatcher`) —
 * funnel through the same `useCloneActions().<verb>(...)` calls. There is no
 * agent-only navigation path, which keeps the agent honest: it cannot
 * fire-and-forget invisible navigation, and any future confirmation, audit,
 * or UI affordance attaches in one place.
 *
 * The agent path passes a server-built `href` (returned from a tool's
 * structured result) directly so the client never recomposes the URL
 * template — the server is the source of truth for the canonical href shape.
 * The user-UI path omits `href` and the dispatcher composes it from
 * `username + kind` (or `username + kind + slug` for content).
 *
 * `buildChatAwareHref` preserves the chat query params (`?chat=1&conversation=...`)
 * across navigation, mirroring the current `<Link>` semantics in both
 * list items.
 *
 * Both verbs call `ensureContentPanelOpen()` from the workspace panel
 * bridge before pushing — guarantees a manually-collapsed panel re-opens
 * on every dispatcher navigation, regardless of whether `hasContentRoute`
 * transitions. Closes the parity gap fixed in PLAN_010 (see
 * `.claude/rules/agent-parity.md` § "Two routes, one dispatcher" — Panel-
 * open invariant).
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
  /**
   * Tab-level parallel of `navigateToContent`. User-UI caller:
   * `apps/mirror/features/profile-tabs/components/profile-tabs.tsx`.
   * Agent caller: `apps/mirror/features/chat/hooks/use-agent-intent-watcher.ts`.
   * Both routes funnel here so the chat-aware suffix and `scroll: false`
   * invariant are applied in exactly one place.
   */
  navigateToProfileSection: (args: {
    section: ProfileTabKind;
    /**
     * Optional override — when called from the agent intent watcher,
     * pass the server-built href directly. The user-UI path omits this
     * and the dispatcher builds the href from `username + section`.
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
  const { ensureContentPanelOpen } = useWorkspacePanelBridge();

  const navigateToContent = useCallback<CloneActions["navigateToContent"]>(
    ({ kind, slug, href }) => {
      // PLAN_010 — both routes funnel through the bridge; mobile no-ops by construction.
      ensureContentPanelOpen();
      // Agent path: server provided the canonical href; do NOT recompose.
      // User path: build from username + kind + slug.
      const basePath = href ?? getContentHref(profile.username, kind, slug);
      router.push(buildChatAwareHref(basePath), { scroll: false });
    },
    [router, profile.username, buildChatAwareHref, ensureContentPanelOpen],
  );

  const navigateToProfileSection = useCallback<
    CloneActions["navigateToProfileSection"]
  >(
    ({ section, href }) => {
      // PLAN_010 — both routes funnel through the bridge; mobile no-ops by construction.
      ensureContentPanelOpen();
      const basePath = href ?? getProfileTabHref(profile.username, section);
      router.push(buildChatAwareHref(basePath), { scroll: false });
    },
    [router, profile.username, buildChatAwareHref, ensureContentPanelOpen],
  );

  const value = useMemo<CloneActions>(
    () => ({ navigateToContent, navigateToProfileSection }),
    [navigateToContent, navigateToProfileSection],
  );

  return (
    <CloneActionsContext.Provider value={value}>
      {children}
    </CloneActionsContext.Provider>
  );
}
