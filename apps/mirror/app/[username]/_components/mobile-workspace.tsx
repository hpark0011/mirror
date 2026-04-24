"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  EXPANDED_SNAP_POINT,
  MobileProfileLayout,
  PEEK_SNAP_POINT,
} from "@/features/profile";
import { type ContentRouteState, ScrollRootProvider } from "@/features/content";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import { useProfileNavigationEffects } from "@/hooks/use-profile-navigation-effects";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";
import { ProfileLogo } from "./profile-logo";
import { CONTENT_PANEL_ID, INTERACTION_PANEL_ID } from "./workspace-panels";

type MobileWorkspaceProps = {
  routeState: ContentRouteState | null;
  isChatOpen: boolean;
  interaction: ReactNode;
  children: ReactNode;
};

type SnapPoint = number | string | null;

const NOOP = () => {};

export function MobileWorkspace({
  routeState,
  isChatOpen,
  interaction,
  children,
}: MobileWorkspaceProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [activeSnapPoint, setActiveSnapPoint] = useState<SnapPoint>(
    PEEK_SNAP_POINT,
  );
  useProfileNavigationEffects(scrollRoot, routeState);

  const toggleContentPanel = useCallback(() => {
    setActiveSnapPoint(EXPANDED_SNAP_POINT);
  }, []);

  const workspaceChromeValue = useMemo(
    () => ({
      contentPanelId: CONTENT_PANEL_ID,
      isContentPanelCollapsed: activeSnapPoint !== EXPANDED_SNAP_POINT,
      toggleContentPanel,
      interactionPanelId: INTERACTION_PANEL_ID,
      isInteractionPanelCollapsed: false,
      toggleInteractionPanel: NOOP,
    }),
    [activeSnapPoint, toggleContentPanel],
  );

  if (isChatOpen) {
    return <main className="h-screen">{interaction}</main>;
  }

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      <main className="h-screen">
        <ToolbarSlotProvider>
          <MobileProfileLayout
            topSlot={<ProfileLogo />}
            activeSnapPoint={activeSnapPoint}
            onActiveSnapPointChange={setActiveSnapPoint}
            profile={
              <div className="relative h-full flex flex-col">
                {interaction}
              </div>
            }
            content={() => (
              <div className="flex h-full min-h-0 flex-col">
                <WorkspaceNavbar className="fixed top-0 inset-x-0" />
                <ToolbarSlotTarget />
                <div className="flex-1 min-h-0 *:h-full">
                  <div
                    ref={setScrollRoot}
                    className="overflow-y-auto overscroll-y-contain h-full px-3"
                  >
                    <ScrollRootProvider value={scrollRoot}>
                      {children}
                    </ScrollRootProvider>
                  </div>
                </div>
              </div>
            )}
          />
        </ToolbarSlotProvider>
      </main>
    </WorkspaceChromeProvider>
  );
}
