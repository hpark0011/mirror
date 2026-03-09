"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { getContentRouteState } from "@/features/content";
import { DesktopWorkspace } from "./desktop-workspace";
import { MobileWorkspace } from "./mobile-workspace";
import { ContentPanel } from "./content-panel";

type WorkspaceShellProps = {
  interaction: ReactNode;
  content: ReactNode;
};

export function WorkspaceShell({ interaction, content }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const segments = useSelectedLayoutSegments();
  const { isChatOpen } = useChatSearchParams();
  const routeState = getContentRouteState(segments);

  if (isMobile) {
    return (
      <MobileWorkspace
        routeState={routeState}
        isChatOpen={isChatOpen}
        interaction={interaction}
      >
        {content}
      </MobileWorkspace>
    );
  }

  return (
    <DesktopWorkspace interaction={interaction}>
      <ContentPanel routeState={routeState}>{content}</ContentPanel>
    </DesktopWorkspace>
  );
}
