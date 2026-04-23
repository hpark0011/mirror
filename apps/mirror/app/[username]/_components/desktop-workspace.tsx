"use client";

import {
  useMemo,
  useRef,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  ResizableHandle,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";
import { DesktopContentPanelToggle } from "./desktop-content-panel-toggle";
import { useContentPanelController } from "../_hooks/use-content-panel-controller";
import { useInteractionPanelController } from "../_hooks/use-interaction-panel-controller";
import { useResizeHandleExpand } from "../_hooks/use-resize-handle-expand";
import {
  CONTENT_PANEL_ID,
  INTERACTION_PANEL_ID,
  WorkspaceContentPanel,
  WorkspaceInteractionPanel,
} from "./workspace-panels";

type DesktopWorkspaceProps = {
  hasContentRoute: boolean;
  interaction: ReactNode;
  children: ReactNode;
  onOpenDefaultContent: (() => void) | null;
};

export function DesktopWorkspace({
  hasContentRoute,
  interaction,
  children,
  onOpenDefaultContent,
}: DesktopWorkspaceProps) {
  const groupRef = useRef<ComponentRef<typeof ResizablePanelGroup>>(null);
  const contentController = useContentPanelController({
    groupRef,
    hasContentRoute,
    onOpenDefaultContent,
  });
  const interactionController = useInteractionPanelController({ groupRef });
  const onResizePointerDownCapture = useResizeHandleExpand(
    contentController,
    interactionController,
  );

  const workspaceChromeValue = useMemo(
    () => ({
      contentPanelId: CONTENT_PANEL_ID,
      isContentPanelCollapsed: contentController.isCollapsed,
      toggleContentPanel: contentController.toggle,
      interactionPanelId: INTERACTION_PANEL_ID,
      isInteractionPanelCollapsed: interactionController.isCollapsed,
      toggleInteractionPanel: interactionController.toggle,
    }),
    [contentController, interactionController],
  );

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      <main className="relative h-screen">
        <ResizablePanelGroup
          id="profile-workspace"
          ref={groupRef}
          direction="horizontal"
          className="h-full"
        >
          <WorkspaceInteractionPanel
            setPanelRef={interactionController.setPanelRef}
            isCollapsed={interactionController.isCollapsed}
            onCollapse={interactionController.onCollapse}
            onExpand={interactionController.onExpand}
            defaultSize={hasContentRoute ? 50 : 100}
          >
            {interaction}
          </WorkspaceInteractionPanel>
          <ResizableHandle
            className="z-30 relative"
            onPointerDownCapture={onResizePointerDownCapture}
          />
          <WorkspaceContentPanel
            setPanelRef={contentController.setPanelRef}
            isCollapsed={contentController.isCollapsed}
            onCollapse={contentController.onCollapse}
            onExpand={contentController.onExpand}
            defaultSize={hasContentRoute ? 50 : 0}
          >
            {children}
          </WorkspaceContentPanel>
        </ResizablePanelGroup>
        <DesktopContentPanelToggle
          contentPanelId={CONTENT_PANEL_ID}
          isContentPanelCollapsed={contentController.isCollapsed}
          toggleContentPanel={contentController.toggle}
        />
      </main>
    </WorkspaceChromeProvider>
  );
}
