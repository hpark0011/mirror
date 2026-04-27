"use client";

import { type ReactNode, useMemo } from "react";
import { useProfileWorkspaceRouteData } from "../_hooks/use-profile-workspace-route-data";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";
import { CONTENT_PANEL_ID, INTERACTION_PANEL_ID } from "./workspace-panels";

type MobileWorkspaceProps = {
  hasContentRoute: boolean;
  interaction: ReactNode;
  children: ReactNode;
};

const NOOP = () => {};

export function MobileWorkspace({
  hasContentRoute,
  interaction,
  children,
}: MobileWorkspaceProps) {
  const { isChatOpen, profileBackHref, openDefaultContent } =
    useProfileWorkspaceRouteData();

  const workspaceChromeValue = useMemo(
    () => ({
      contentPanelId: CONTENT_PANEL_ID,
      isContentPanelCollapsed: !hasContentRoute,
      toggleContentPanel: openDefaultContent ?? NOOP,
      interactionPanelId: INTERACTION_PANEL_ID,
      isInteractionPanelCollapsed: false,
      toggleInteractionPanel: NOOP,
      showContentPanelToggle: false,
      backHref: profileBackHref ?? undefined,
    }),
    [hasContentRoute, openDefaultContent, profileBackHref],
  );

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      <main className="h-screen">
        {isChatOpen || !hasContentRoute ? interaction : children}
      </main>
    </WorkspaceChromeProvider>
  );
}
