"use client";

import {
  useCallback,
  useEffect,
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
import {
  markContentPanelOpenStart,
  markContentPanelRouteReady,
} from "@/lib/perf/content-panel-open";
import { WorkspaceChromeProvider } from "../_providers/workspace-chrome-context";

const CONTENT_PANEL_ID = "profile-content-panel";
const INTERACTION_PANEL_ID = "profile-interaction-panel";

// Lifecycle fallback: if the default-content navigation does not flip
// `hasContentRoute` within this window (e.g., router.push was aborted,
// the user navigated away before commit, or transitions stalled), clear
// the pending-navigation guard so the toggle remains operable. This is a
// lifecycle recovery, not rendering timing — see `.claude/rules/react-components.md`.
const PENDING_NAVIGATION_TIMEOUT_MS = 1800;

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
  const interactionPanelRef = useRef<ComponentRef<typeof ResizablePanel>>(null);
  const isPendingNavigationRef = useRef(false);
  const pendingNavigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const previousHasContentRouteRef = useRef(hasContentRoute);

  const clearPendingNavigationTimeout = useCallback(() => {
    if (pendingNavigationTimeoutRef.current !== null) {
      clearTimeout(pendingNavigationTimeoutRef.current);
      pendingNavigationTimeoutRef.current = null;
    }
  }, []);

  const clearPendingNavigation = useCallback(() => {
    isPendingNavigationRef.current = false;
    clearPendingNavigationTimeout();
  }, [clearPendingNavigationTimeout]);
  const [isContentPanelCollapsed, setIsContentPanelCollapsed] = useState(
    () => !hasContentRoute,
  );
  const [isInteractionPanelCollapsed, setIsInteractionPanelCollapsed] =
    useState(false);

  const handleContentPanelCollapse = useCallback(() => {
    setIsContentPanelCollapsed(true);
  }, []);

  const handleContentPanelExpand = useCallback(() => {
    setIsContentPanelCollapsed(false);
  }, []);

  const handleInteractionPanelCollapse = useCallback(() => {
    setIsInteractionPanelCollapsed(true);
  }, []);

  const handleInteractionPanelExpand = useCallback(() => {
    setIsInteractionPanelCollapsed(false);
  }, []);

  const openDefaultContentRoute = useCallback(() => {
    if (!onOpenDefaultContent) return;

    markContentPanelOpenStart();
    isPendingNavigationRef.current = true;
    // Arm the fallback: if `hasContentRoute` never flips, recover the
    // guard so subsequent toggle clicks are not permanently no-ops.
    clearPendingNavigationTimeout();
    pendingNavigationTimeoutRef.current = setTimeout(() => {
      isPendingNavigationRef.current = false;
      pendingNavigationTimeoutRef.current = null;
    }, PENDING_NAVIGATION_TIMEOUT_MS);
    onOpenDefaultContent();
  }, [clearPendingNavigationTimeout, onOpenDefaultContent]);

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

  const toggleInteractionPanel = useCallback(() => {
    if (isInteractionPanelCollapsed) {
      groupRef.current?.setLayout([50, 50]);
      return;
    }

    interactionPanelRef.current?.collapse();
  }, [isInteractionPanelCollapsed]);

  const handleResizePointerDownCapture = useCallback<
    ResizableHandlePointerDownCapture
  >((event) => {
    if (isInteractionPanelCollapsed) {
      event.preventDefault();
      event.stopPropagation();
      groupRef.current?.setLayout([50, 50]);
      return;
    }

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
    isInteractionPanelCollapsed,
    openDefaultContentRoute,
  ]);

  useLayoutEffect(() => {
    const previousHasContentRoute = previousHasContentRouteRef.current;
    previousHasContentRouteRef.current = hasContentRoute;

    if (previousHasContentRoute === hasContentRoute) {
      return;
    }

    // Any observed transition clears the pending-navigation guard. The
    // happy `false → true` path is the intended case, but `true → false`
    // (user navigated away mid-flight) must also release the latch so
    // subsequent toggle clicks keep working.
    clearPendingNavigation();

    if (hasContentRoute) {
      markContentPanelRouteReady();
      groupRef.current?.setLayout([50, 50]);
      return;
    }

    contentPanelRef.current?.collapse();
  }, [clearPendingNavigation, hasContentRoute]);

  // Ensure the timeout fallback does not fire after unmount.
  useEffect(() => {
    return () => {
      clearPendingNavigationTimeout();
    };
  }, [clearPendingNavigationTimeout]);

  const workspaceChromeValue = useMemo(
    () => ({
      contentPanelId: CONTENT_PANEL_ID,
      isContentPanelCollapsed,
      toggleContentPanel,
      interactionPanelId: INTERACTION_PANEL_ID,
      isInteractionPanelCollapsed,
      toggleInteractionPanel,
    }),
    [
      isContentPanelCollapsed,
      toggleContentPanel,
      isInteractionPanelCollapsed,
      toggleInteractionPanel,
    ],
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
            ref={interactionPanelRef}
            defaultSize={hasContentRoute ? 50 : 100}
            minSize={25}
            maxSize={100}
            collapsible
            collapsedSize={0}
            className="min-w-0 overflow-hidden"
            onCollapse={handleInteractionPanelCollapse}
            onExpand={handleInteractionPanelExpand}
          >
            <div
              id={INTERACTION_PANEL_ID}
              data-state={isInteractionPanelCollapsed ? "closed" : "open"}
              data-testid="desktop-interaction-panel"
              aria-hidden={isInteractionPanelCollapsed}
              inert={isInteractionPanelCollapsed}
              className="h-full"
            >
              {interaction}
            </div>
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
            maxSize={100}
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
