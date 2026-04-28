"use client";

import {
  useMemo,
  useRef,
  type ComponentRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ResizableHandle,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";
import { useContentPanelController } from "../_hooks/use-content-panel-controller";
import { useInteractionPanelController } from "../_hooks/use-interaction-panel-controller";
import { useResizeHandleExpand } from "../_hooks/use-resize-handle-expand";
import { CollapsedProfileAvatarButton } from "./collapsed-profile-avatar-button";
import {
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
      isContentPanelCollapsed: contentController.isCollapsed,
      toggleContentPanel: contentController.toggle,
      isInteractionPanelCollapsed: interactionController.isCollapsed,
      toggleInteractionPanel: interactionController.toggle,
      showProfilePanelToggle: true,
      canCollapseInteractionPanel: true,
      canCollapseContentPanel: true,
      backHref: undefined,
    }),
    [contentController, interactionController],
  );

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      {/*
        Vertical padding the ProfilePanel reserves for desktop chrome:
        --workspace-content-top-pad clears the WorkspaceNavbar at the top
        and --workspace-content-bottom-pad clears the bottom toolbar stack.
        Bump these if either chrome surface grows or shrinks.
      */}
      <main
        className="relative h-screen"
        style={
          {
            "--workspace-content-top-pad": "132px",
            "--workspace-content-bottom-pad": "132px",
          } as CSSProperties
        }
      >
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
        <CollapsedProfileAvatarButton />
      </main>
    </WorkspaceChromeProvider>
  );
}
