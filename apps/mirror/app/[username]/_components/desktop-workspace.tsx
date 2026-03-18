"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";

const CONTENT_PANEL_ID = "profile-content-panel";

type DesktopWorkspaceProps = {
  hasContentRoute: boolean;
  interaction: ReactNode;
  children: ReactNode;
  onOpenDefaultContent: (() => void) | null;
};

type ResizableHandlePointerDownCapture = NonNullable<
  ComponentProps<typeof ResizableHandle>["onPointerDownCapture"]
>;

export function DesktopWorkspace({
  hasContentRoute,
  interaction,
  children,
  onOpenDefaultContent,
}: DesktopWorkspaceProps) {
  const groupRef = useRef<ComponentRef<typeof ResizablePanelGroup>>(null);
  const contentPanelRef = useRef<ComponentRef<typeof ResizablePanel>>(null);
  const isPendingNavigationRef = useRef(false);
  const previousHasContentRouteRef = useRef(hasContentRoute);
  const [isContentPanelCollapsed, setIsContentPanelCollapsed] = useState(
    () => !hasContentRoute,
  );

  const handleContentPanelCollapse = useCallback(() => {
    setIsContentPanelCollapsed(true);
  }, []);

  const handleContentPanelExpand = useCallback(() => {
    setIsContentPanelCollapsed(false);
  }, []);

  const openDefaultContentRoute = useCallback(() => {
    if (!onOpenDefaultContent) return;

    isPendingNavigationRef.current = true;
    onOpenDefaultContent();
  }, [onOpenDefaultContent]);

  const toggleContentPanel = useCallback(() => {
    if (isPendingNavigationRef.current) return;

    if (isContentPanelCollapsed) {
      if (!hasContentRoute) {
        openDefaultContentRoute();
        return;
      }

      groupRef.current?.setLayout([50, 50]);
      return;
    }

    contentPanelRef.current?.collapse();
  }, [hasContentRoute, isContentPanelCollapsed, openDefaultContentRoute]);

  const handleResizePointerDownCapture = useCallback<
    ResizableHandlePointerDownCapture
  >((event) => {
    if (!isContentPanelCollapsed) return;

    event.preventDefault();
    event.stopPropagation();

    if (isPendingNavigationRef.current) return;

    if (!hasContentRoute) {
      openDefaultContentRoute();
      return;
    }

    groupRef.current?.setLayout([50, 50]);
  }, [
    hasContentRoute,
    isContentPanelCollapsed,
    openDefaultContentRoute,
  ]);

  useLayoutEffect(() => {
    const previousHasContentRoute = previousHasContentRouteRef.current;
    previousHasContentRouteRef.current = hasContentRoute;

    if (previousHasContentRoute === hasContentRoute) {
      return;
    }

    if (hasContentRoute) {
      isPendingNavigationRef.current = false;
      groupRef.current?.setLayout([50, 50]);
      return;
    }

    contentPanelRef.current?.collapse();
  }, [hasContentRoute]);

  const workspaceChromeValue = useMemo(
    () => ({
      contentPanelId: CONTENT_PANEL_ID,
      isContentPanelCollapsed,
      toggleContentPanel,
    }),
    [isContentPanelCollapsed, toggleContentPanel],
  );

  return (
    <WorkspaceChromeProvider value={workspaceChromeValue}>
      <main className="h-screen">
        <ResizablePanelGroup
          id="profile-workspace"
          ref={groupRef}
          direction="horizontal"
          className="h-full"
        >
          <ResizablePanel
            id="profile-workspace-interaction"
            defaultSize={hasContentRoute ? 50 : 100}
            minSize={25}
            maxSize={100}
          >
            {interaction}
          </ResizablePanel>

          <ResizableHandle
            className="z-30 relative"
            onPointerDownCapture={handleResizePointerDownCapture}
          />

          <ResizablePanel
            id="profile-workspace-content"
            ref={contentPanelRef}
            defaultSize={hasContentRoute ? 50 : 0}
            minSize={25}
            maxSize={80}
            collapsible
            collapsedSize={0}
            className="min-w-0 overflow-hidden"
            onCollapse={handleContentPanelCollapse}
            onExpand={handleContentPanelExpand}
          >
            <div
              id={CONTENT_PANEL_ID}
              data-state={isContentPanelCollapsed ? "closed" : "open"}
              data-testid="desktop-content-panel"
              aria-hidden={isContentPanelCollapsed}
              inert={isContentPanelCollapsed}
              className="h-full"
            >
              {/*
                Keep the content subtree mounted so route and scroll state survive
                desktop panel toggles.
              */}
              {children}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </WorkspaceChromeProvider>
  );
}
