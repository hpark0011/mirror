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
  DEFAULT_PROFILE_CONTENT_KIND,
  getContentHref,
  getContentRouteState,
  type ContentRouteState,
} from "@/features/content";
import { isProfileTabKind } from "@/features/profile-tabs/types";

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

  const username = params.username;
  const hasContentRoute = isProfileTabKind(segments[0]);
  const routeState = getContentRouteState(segments);

  const defaultContentHref = useMemo(() => {
    if (!username) return null;

    const href = getContentHref(username, DEFAULT_PROFILE_CONTENT_KIND);
    const queryString = searchParams.toString();
    return queryString ? `${href}?${queryString}` : href;
  }, [searchParams, username]);

  const profileBackHref = useMemo(() => {
    if (!username) return null;
    return buildChatAwareHref(`/@${username}/posts`);
  }, [buildChatAwareHref, username]);

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
