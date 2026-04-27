"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
  useSelectedLayoutSegments,
} from "next/navigation";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import {
  DEFAULT_PROFILE_CONTENT_KIND,
  getContentHref,
  getContentRouteState,
  type ContentRouteState,
} from "@/features/content";
import { isProfileTabKind } from "@/features/profile-tabs/types";
import { DesktopWorkspace } from "./desktop-workspace";
import { MobileWorkspace } from "./mobile-workspace";
import { ContentPanel } from "./content-panel";

type WorkspaceShellProps = {
  interaction: ReactNode;
  content: ReactNode;
};

export function WorkspaceShell({ interaction, content }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const segments = useSelectedLayoutSegments();
  const { isChatOpen, buildChatAwareHref } = useChatSearchParams();
  const hasContentRoute = isProfileTabKind(segments[0]);
  const routeState: ContentRouteState | null =
    segments[0] === "clone-settings"
      ? null
      : getContentRouteState(segments);
  const username = params.username;
  const defaultContentHref = useMemo(() => {
    if (!username) return null;

    const href = getContentHref(username, DEFAULT_PROFILE_CONTENT_KIND);
    const queryString = searchParams.toString();
    return queryString ? `${href}?${queryString}` : href;
  }, [searchParams, username]);

  const profileBackHref = useMemo(() => {
    if (!username) return null;
    return buildChatAwareHref(`/@${username}`);
  }, [buildChatAwareHref, username]);

  const openDefaultContent = useCallback(() => {
    if (!defaultContentHref) return;
    router.push(defaultContentHref);
  }, [defaultContentHref, router]);

  return (
    isMobile
      ? (
        <MobileWorkspace
          isChatOpen={isChatOpen}
          hasContentRoute={hasContentRoute}
          interaction={interaction}
          onOpenDefaultContent={defaultContentHref ? openDefaultContent : null}
        >
          <ContentPanel
            routeState={routeState}
            navbarBackHref={profileBackHref ?? undefined}
            showContentPanelToggle={false}
          >
            {content}
          </ContentPanel>
        </MobileWorkspace>
      )
      : (
        <DesktopWorkspace
          interaction={interaction}
          hasContentRoute={hasContentRoute}
          onOpenDefaultContent={defaultContentHref ? openDefaultContent : null}
        >
          <ContentPanel routeState={routeState}>{content}</ContentPanel>
        </DesktopWorkspace>
      )
  );
}
