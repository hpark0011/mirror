"use client";

/**
 * PLAN_010 — closes the agent-UI parity gap where the dispatcher pushes a new
 * content URL but a manually-collapsed content panel stays collapsed because
 * `useContentPanelController`'s layout effect only fires on the
 * `hasContentRoute: false → true` transition.
 *
 * Satisfies `.claude/rules/agent-parity.md` § "Two routes, one dispatcher" —
 * we are NOT adding a new agent verb. The bridge is a thin imperative seam
 * that lets the dispatcher (an upstream provider) ask the workspace chrome
 * (a downstream provider) to open the content panel before navigating.
 *
 * Consumers:
 * - Caller: `clone-actions-context.tsx` invokes `ensureContentPanelOpen()`
 *   inside both `navigateToContent` and `navigateToProfileSection`.
 * - Registrant: `desktop-workspace.tsx` registers
 *   `contentController.ensureExpanded`. Mobile does not register —
 *   content visibility is route-driven via `MobileWorkspace`'s
 *   `isChatOpen || !hasContentRoute` render branch, so the bridge is a no-op
 *   on mobile by construction.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type WorkspacePanelBridgeContextValue = {
  /**
   * Workspace-side handlers register an imperative "ensure the content
   * panel is open" callback. Returns an unregister cleanup.
   *
   * Only one callback is active at a time. The current registrant wins —
   * a re-registration overwrites. Desktop registers; mobile does not.
   */
  register: (fn: () => void) => () => void;
  /**
   * Dispatcher-side callers ask the bridge to open the content panel
   * before navigating. No-op when no callback is registered (mobile,
   * SSR, tests with no workspace mounted).
   */
  ensureContentPanelOpen: () => void;
};

const WorkspacePanelBridgeContext =
  createContext<WorkspacePanelBridgeContextValue | null>(null);

export function useOptionalWorkspacePanelBridge() {
  return useContext(WorkspacePanelBridgeContext);
}

export function useWorkspacePanelBridge() {
  const ctx = useOptionalWorkspacePanelBridge();
  if (!ctx) {
    throw new Error(
      "useWorkspacePanelBridge must be used within WorkspacePanelBridgeProvider",
    );
  }
  return ctx;
}

type WorkspacePanelBridgeProviderProps = {
  children: ReactNode;
};

export function WorkspacePanelBridgeProvider({
  children,
}: WorkspacePanelBridgeProviderProps) {
  const handlerRef = useRef<(() => void) | null>(null);

  const register = useCallback((fn: () => void) => {
    handlerRef.current = fn;
    // Stale-cleanup guard: a StrictMode dev double-mount fires the
    // previous registration's cleanup AFTER the new registration writes
    // its handler. Only clear the slot if `fn` is still the active
    // registrant.
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const ensureContentPanelOpen = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const value = useMemo<WorkspacePanelBridgeContextValue>(
    () => ({ register, ensureContentPanelOpen }),
    [register, ensureContentPanelOpen],
  );

  return (
    <WorkspacePanelBridgeContext.Provider value={value}>
      {children}
    </WorkspacePanelBridgeContext.Provider>
  );
}
