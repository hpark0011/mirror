"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ToolbarSlotContextValue = {
  portalTarget: HTMLElement | null;
  setPortalTarget: (el: HTMLElement | null) => void;
};

const ToolbarSlotContext = createContext<ToolbarSlotContextValue | null>(null);

export function ToolbarSlotProvider({ children }: { children: React.ReactNode }) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ portalTarget, setPortalTarget }), [portalTarget]);
  return (
    <ToolbarSlotContext.Provider value={value}>
      {children}
    </ToolbarSlotContext.Provider>
  );
}

/** Renders the DOM target element where toolbar content will be portaled into. */
export function ToolbarSlotTarget() {
  const ctx = useContext(ToolbarSlotContext);
  if (!ctx) throw new Error("ToolbarSlotTarget must be used within ToolbarSlotProvider");
  const { setPortalTarget } = ctx;
  const divRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setPortalTarget(divRef.current);
    return () => setPortalTarget(null);
  }, [setPortalTarget]);

  return <div ref={divRef} className="shrink-0 h-10 bg-background" />;
}

/** Portals children into the ToolbarSlotTarget. Children stay in their original React tree (preserving context). */
export function WorkspaceToolbar({ children }: { children: React.ReactNode }) {
  const ctx = useContext(ToolbarSlotContext);
  if (!ctx) throw new Error("WorkspaceToolbar must be used within ToolbarSlotProvider");
  if (!ctx.portalTarget) return null;
  return createPortal(children, ctx.portalTarget);
}
