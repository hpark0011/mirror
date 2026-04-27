"use client";

import { type ReactNode } from "react";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import { useProfileWorkspaceRouteData } from "../_hooks/use-profile-workspace-route-data";
import { DesktopWorkspace } from "./desktop-workspace";
import { MobileWorkspace } from "./mobile-workspace";
import { ContentPanel } from "./content-panel";

type WorkspaceShellProps = {
  interaction: ReactNode;
  content: ReactNode;
};

export function WorkspaceShell({ interaction, content }: WorkspaceShellProps) {
  const isMobile = useIsMobile();
  const { hasContentRoute, routeState, openDefaultContent } =
    useProfileWorkspaceRouteData();

  return isMobile ? (
    <MobileWorkspace hasContentRoute={hasContentRoute} interaction={interaction}>
      <ContentPanel routeState={routeState}>{content}</ContentPanel>
    </MobileWorkspace>
  ) : (
    <DesktopWorkspace
      interaction={interaction}
      hasContentRoute={hasContentRoute}
      onOpenDefaultContent={openDefaultContent}
    >
      <ContentPanel routeState={routeState}>{content}</ContentPanel>
    </DesktopWorkspace>
  );
}
