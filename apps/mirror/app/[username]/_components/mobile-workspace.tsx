"use client";

import { type ReactNode, useMemo } from "react";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";
import { CONTENT_PANEL_ID, INTERACTION_PANEL_ID } from "./workspace-panels";

type MobileWorkspaceProps = {
  isChatOpen: boolean;
  hasContentRoute: boolean;
  interaction: ReactNode;
  children: ReactNode;
  onOpenDefaultContent: (() => void) | null;
  profileBackHref: string | null;
};

const NOOP = () => {};

export function MobileWorkspace({
  isChatOpen,
  hasContentRoute,
  interaction,
  children,
  onOpenDefaultContent,
  profileBackHref,
}: MobileWorkspaceProps) {
  const workspaceChromeValue = useMemo(
    () => ({
      contentPanelId: CONTENT_PANEL_ID,
      isContentPanelCollapsed: !hasContentRoute,
      toggleContentPanel: onOpenDefaultContent ?? NOOP,
      interactionPanelId: INTERACTION_PANEL_ID,
      isInteractionPanelCollapsed: false,
      toggleInteractionPanel: NOOP,
      showContentPanelToggle: false,
      backHref: profileBackHref ?? undefined,
    }),
    [hasContentRoute, onOpenDefaultContent, profileBackHref],
  );

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      <main className="h-screen">
        {isChatOpen || !hasContentRoute ? interaction : children}
      </main>
    </WorkspaceChromeProvider>
  );
}
