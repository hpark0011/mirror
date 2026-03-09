"use client";

import { useCallback, useEffect, useMemo, type ReactNode } from "react";
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
  isContentKind,
} from "@/features/content";
import { DesktopWorkspace } from "./desktop-workspace";
import { MobileWorkspace } from "./mobile-workspace";
import { ContentPanel } from "./content-panel";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function hasMobileViewport() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

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
  const { isChatOpen } = useChatSearchParams();
  const hasContentRoute = isContentKind(segments[0]);
  const routeState = getContentRouteState(segments);
  const username = params.username;
  const defaultContentHref = useMemo(() => {
    if (!username) return null;

    const href = getContentHref(username, DEFAULT_PROFILE_CONTENT_KIND);
    const queryString = searchParams.toString();
    return queryString ? `${href}?${queryString}` : href;
  }, [searchParams, username]);
  const shouldRedirectMobileRoot = !hasContentRoute &&
    !!defaultContentHref &&
    (isMobile || hasMobileViewport());

  const openDefaultContent = useCallback(() => {
    if (!defaultContentHref) return;
    router.push(defaultContentHref);
  }, [defaultContentHref, router]);

  useEffect(() => {
    if (!shouldRedirectMobileRoot || !defaultContentHref) return;
    router.replace(defaultContentHref);
  }, [defaultContentHref, router, shouldRedirectMobileRoot]);

  if (shouldRedirectMobileRoot) {
    return null;
  }

  return (
    isMobile
      ? (
        <MobileWorkspace
          routeState={routeState}
          isChatOpen={isChatOpen}
          interaction={interaction}
        >
          {content}
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
