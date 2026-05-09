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
import {
  type ResizablePanel,
  type ResizablePanelGroup,
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
  /**
   * Imperative "if collapsed, open without falling back to default-content
   * navigation." Distinct from `expand()` because the caller (the dispatcher
   * in `clone-actions-context.tsx`) is itself about to `router.push` to a
   * specific content URL — falling back to `openDefaultContentRoute()` would
   * race that push. Used by `WorkspacePanelBridgeProvider` to satisfy the
   * panel-open invariant on every dispatcher navigation.
   */
  ensureExpanded: () => void;
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

  // `ensureExpanded` must be a stable identity so the panel-bridge
  // registration in `useRegisterContentPanelBridge` runs once at mount.
  // If we closed over `isCollapsed` directly, the closure would change
  // on every collapse/expand and the bridge re-registration would race
  // descendant passive effects (e.g. `useAgentIntentWatcher` in
  // `ChatActiveThread`): when `isCollapsed` flips and a tool-result
  // lands in the same commit, the descendant's `useEffect` runs first
  // and reads the still-stale closure from `handlerRef.current`. Reading
  // `isCollapsed` from a ref synced via `useLayoutEffect` lets all
  // passive effects observe the latest value regardless of tree depth.
  const isCollapsedRef = useRef(isCollapsed);
  useLayoutEffect(() => {
    isCollapsedRef.current = isCollapsed;
  }, [isCollapsed]);

  // Called by the dispatcher (`useCloneActions`) via the panel-bridge
  // before every `router.push`. Distinct from `expand()`: must NOT call
  // `openDefaultContentRoute()` when `!hasContentRoute`, because the
  // dispatcher is itself about to push a more specific content URL —
  // a fallback default-content push would race it.
  const ensureExpanded = useCallback(() => {
    if (!isCollapsedRef.current) return;
    if (pendingNav.isArmed()) return;
    groupRef.current?.setLayout([...OPEN_LAYOUT]);
  }, [groupRef, pendingNav]);

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

  return {
    setPanelRef,
    isCollapsed,
    onCollapse,
    onExpand,
    toggle,
    expand,
    ensureExpanded,
  };
}
