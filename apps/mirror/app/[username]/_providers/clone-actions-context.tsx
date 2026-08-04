"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  getContentEditHref,
  getContentHref,
  type ContentKind,
} from "@/features/content";
import {
  getProfileTabHref,
  type ProfileTabKind,
} from "@/features/profile-tabs/types";
import { useProfileRouteData } from "./profile-route-data-context";

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
 * Navigation always targets the canonical content URL directly. Obsolete
 * chat query state is canonicalized at the request boundary before this
 * provider mounts.
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
   * Both routes funnel here so the `scroll: false` invariant is applied in
   * exactly one place.
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
  /**
   * Navigate to the inline editor for a specific post. Owner-only verb —
   * called from the post-list Edit action (user-UI path) and from the
   * `editPost` tool result watcher (agent path). Both routes funnel here so
   * the `scroll: false` invariant applies in one place.
   *
   * Agent path: passes the server-built `editHref` directly so the client
   * never recomposes the URL template.
   * User-UI path: omits `editHref` and the dispatcher builds it from
   * `username + kind + slug` via `getContentEditHref`.
   */
  navigateToEditor: (args: {
    kind: ContentKind;
    slug: string;
    /**
     * Optional override — when called from the agent intent watcher,
     * pass the server-built editHref directly instead of recomposing
     * client-side.
     */
    editHref?: string;
  }) => void;
};

const CloneActionsContext = createContext<CloneActions | null>(null);

export function useCloneActions() {
  const ctx = useContext(CloneActionsContext);
  if (!ctx) {
    throw new Error("useCloneActions must be used within CloneActionsProvider");
  }
  return ctx;
}

type CloneActionsProviderProps = {
  children: ReactNode;
};

export function CloneActionsProvider({ children }: CloneActionsProviderProps) {
  const router = useRouter();
  const { profile } = useProfileRouteData();

  const navigateToContent = useCallback<CloneActions["navigateToContent"]>(
    ({ kind, slug, href }) => {
      // Agent path: server provided the canonical href; do NOT recompose.
      // User path: build from username + kind + slug.
      const basePath = href ?? getContentHref(profile.username, kind, slug);
      router.push(basePath, { scroll: false });
    },
    [router, profile.username],
  );

  const navigateToProfileSection = useCallback<
    CloneActions["navigateToProfileSection"]
  >(
    ({ section, href }) => {
      const basePath = href ?? getProfileTabHref(profile.username, section);
      router.push(basePath, { scroll: false });
    },
    [router, profile.username],
  );

  const navigateToEditor = useCallback<CloneActions["navigateToEditor"]>(
    ({ kind, slug, editHref }) => {
      // Agent path: server provided the canonical editHref; do NOT recompose.
      // User-UI path: build from username + kind + slug.
      const basePath =
        editHref ?? getContentEditHref(profile.username, kind, slug);
      router.push(basePath, { scroll: false });
    },
    [router, profile.username],
  );

  const value = useMemo<CloneActions>(
    () => ({ navigateToContent, navigateToProfileSection, navigateToEditor }),
    [navigateToContent, navigateToProfileSection, navigateToEditor],
  );

  return (
    <CloneActionsContext.Provider value={value}>
      {children}
    </CloneActionsContext.Provider>
  );
}
