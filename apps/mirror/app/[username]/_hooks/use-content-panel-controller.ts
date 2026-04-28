"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
  type RefCallback,
  type RefObject,
} from "react";
import type {
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import {
  markContentPanelOpenStart,
  markContentPanelRouteReady,
} from "@/lib/perf/content-panel-open";
import { OPEN_LAYOUT } from "./workspace-layout-constants";
import { usePendingNavigationLatch } from "./use-pending-navigation-latch";

type PanelRef = ComponentRef<typeof ResizablePanel>;
type GroupRef = ComponentRef<typeof ResizablePanelGroup>;

type UseContentPanelControllerArgs = {
  groupRef: RefObject<GroupRef | null>;
  hasContentRoute: boolean;
  onOpenDefaultContent: (() => void) | null;
};

export type ContentPanelController = {
  setPanelRef: RefCallback<PanelRef>;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  toggle: () => void;
  /** Returns true if expansion (or default-content nav) was initiated. */
  expand: () => boolean;
};

export function useContentPanelController({
  groupRef,
  hasContentRoute,
  onOpenDefaultContent,
}: UseContentPanelControllerArgs): ContentPanelController {
  const panelRef = useRef<PanelRef | null>(null);
  const setPanelRef = useCallback<RefCallback<PanelRef>>((node) => {
    panelRef.current = node;
  }, []);
  const previousHasContentRouteRef = useRef(hasContentRoute);
  const [isCollapsed, setIsCollapsed] = useState(() => !hasContentRoute);
  const pendingNav = usePendingNavigationLatch();

  const onCollapse = useCallback(() => setIsCollapsed(true), []);
  const onExpand = useCallback(() => setIsCollapsed(false), []);

  const openDefaultContentRoute = useCallback(() => {
    if (!onOpenDefaultContent) return;
    markContentPanelOpenStart();
    pendingNav.arm();
    onOpenDefaultContent();
  }, [onOpenDefaultContent, pendingNav]);

  // Single source of truth for the "if collapsed, open this panel"
  // policy. Shared by `toggle` (collapse/expand button) and
  // `useResizeHandleExpand` (drag-to-open on the handle).
  const expand = useCallback(() => {
    if (!isCollapsed) return false;
    if (pendingNav.isArmed()) return false;
    if (!hasContentRoute) {
      openDefaultContentRoute();
      return true;
    }
    groupRef.current?.setLayout([...OPEN_LAYOUT]);
    return true;
  }, [groupRef, hasContentRoute, isCollapsed, openDefaultContentRoute, pendingNav]);

  const toggle = useCallback(() => {
    if (pendingNav.isArmed()) return;
    if (isCollapsed) {
      expand();
      return;
    }
    panelRef.current?.collapse();
  }, [expand, isCollapsed, pendingNav]);

  useLayoutEffect(() => {
    const previousHasContentRoute = previousHasContentRouteRef.current;
    previousHasContentRouteRef.current = hasContentRoute;
    if (previousHasContentRoute === hasContentRoute) return;

    // Any observed transition releases the latch (true→false covers the
    // user navigating away mid-flight, not just the happy false→true).
    pendingNav.clear();

    if (hasContentRoute) {
      markContentPanelRouteReady();
      groupRef.current?.setLayout([...OPEN_LAYOUT]);
      return;
    }
    panelRef.current?.collapse();
  }, [groupRef, hasContentRoute, pendingNav]);

  return { setPanelRef, isCollapsed, onCollapse, onExpand, toggle, expand };
}
