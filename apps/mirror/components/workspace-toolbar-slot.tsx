"use client";

import {
  createContext,
  type ReactElement,
  type ReactNode,
  type ReactPortal,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ToolbarSlotContextValue = {
  portalTarget: HTMLElement | null;
  setPortalTarget: (element: HTMLElement | null) => void;
};

const ToolbarSlotContext = createContext<ToolbarSlotContextValue | null>(null);

type ToolbarSlotProviderProps = {
  children: ReactNode;
};

export function ToolbarSlotProvider({
  children,
}: ToolbarSlotProviderProps): ReactElement {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const value = useMemo<ToolbarSlotContextValue>(
    () => ({ portalTarget, setPortalTarget }),
    [portalTarget],
  );

  return (
    <ToolbarSlotContext.Provider value={value}>
      {children}
    </ToolbarSlotContext.Provider>
  );
}

/** Renders the DOM target element where toolbar content will be portaled into. */
export function ToolbarSlotTarget(): ReactElement {
  const context = useContext(ToolbarSlotContext);
  if (!context) {
    throw new Error(
      "ToolbarSlotTarget must be used within ToolbarSlotProvider",
    );
  }

  const { setPortalTarget } = context;
  const targetRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setPortalTarget(targetRef.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);

  return (
    <div
      ref={targetRef}
      className="relative flex h-full min-w-0 flex-1 items-center justify-end"
    />
  );
}

type WorkspaceToolbarProps = {
  children: ReactNode;
};

/** Portals children while preserving their original React context. */
export function WorkspaceToolbar({
  children,
}: WorkspaceToolbarProps): ReactPortal | null {
  const context = useContext(ToolbarSlotContext);
  if (!context) {
    throw new Error("WorkspaceToolbar must be used within ToolbarSlotProvider");
  }

  if (!context.portalTarget) {
    return null;
  }

  return createPortal(children, context.portalTarget);
}
