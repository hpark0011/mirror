"use client";

import { useCallback, useMemo } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegments,
} from "next/navigation";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import {
  getContentRouteState,
  type ContentRouteState,
} from "@/features/content";
import {
  getProfileTabHref,
  isProfileTabKind,
} from "@/features/profile-tabs/types";
import { useProfileRouteData } from "../_providers/profile-route-data-context";

export type ProfileWorkspaceRouteData = {
  isChatOpen: boolean;
  hasContentRoute: boolean;
  routeState: ContentRouteState | null;
  defaultContentHref: string | null;
  profileBackHref: string | null;
  openDefaultContent: (() => void) | null;
};

/**
 * Single source of truth for profile-workspace route derivation. Owns the
 * only call sites of `getContentRouteState`, `isProfileTabKind` (for
 * `hasContentRoute`), `getContentHref` (for `defaultContentHref`), and
 * `buildChatAwareHref` (for `profileBackHref`) outside their own modules.
 */
export function useProfileWorkspaceRouteData(): ProfileWorkspaceRouteData {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const segments = useSelectedLayoutSegments();
  const { isChatOpen, buildChatAwareHref } = useChatSearchParams();
  const { profile } = useProfileRouteData();

  const username = params.username;
  const hasContentRoute = isProfileTabKind(segments[0]);
  const routeState = getContentRouteState(segments);

  const defaultContentHref = useMemo(() => {
    if (!username) return null;

    const href = getProfileTabHref(username, profile.defaultProfileSection);
    const queryString = searchParams.toString();
    return queryString ? `${href}?${queryString}` : href;
  }, [profile.defaultProfileSection, searchParams, username]);

  const profileBackHref = useMemo(() => {
    if (!username) return null;
    return buildChatAwareHref(
      getProfileTabHref(username, profile.defaultProfileSection),
    );
  }, [buildChatAwareHref, profile.defaultProfileSection, username]);

  const openDefaultContent = useCallback(() => {
    if (!defaultContentHref) return;
    router.push(defaultContentHref);
  }, [defaultContentHref, router]);

  return {
    isChatOpen,
    hasContentRoute,
    routeState,
    defaultContentHref,
    profileBackHref,
    openDefaultContent: defaultContentHref ? openDefaultContent : null,
  };
}
