"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";
import { useProfileWorkspaceRouteData } from "../_hooks/use-profile-workspace-route-data";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";

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
      isContentPanelCollapsed: !hasContentRoute,
      toggleContentPanel: openDefaultContent ?? NOOP,
      isInteractionPanelCollapsed: false,
      toggleInteractionPanel: NOOP,
      showProfilePanelToggle: false,
      canCollapseInteractionPanel: false,
      canCollapseContentPanel: false,
      backHref: profileBackHref ?? undefined,
    }),
    [hasContentRoute, openDefaultContent, profileBackHref],
  );

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      {/*
        Vertical padding the ProfilePanel reserves for mobile chrome:
        --workspace-content-top-pad clears the mobile WorkspaceNavbar at the top.
        Mobile has no bottom toolbar floating over the profile, so the bottom
        pad is 0. Bump these if either chrome surface gains height.
      */}
      <main
        className="h-screen"
        style={
          {
            "--workspace-content-top-pad": "96px",
            "--workspace-content-bottom-pad": "0px",
          } as CSSProperties
        }
      >
        {isChatOpen || !hasContentRoute ? interaction : children}
      </main>
    </WorkspaceChromeProvider>
  );
}
