"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

export type LayoutPreference = "board" | "list";

interface LayoutModeContextValue {
  /** Whether list layout is active (mobile or user preference) */
  isListLayout: boolean;
  /** User's saved layout preference */
  layoutPref: LayoutPreference;
  /** Update user's layout preference */
  setLayoutPref: (pref: LayoutPreference) => void;
  /** Whether viewport is mobile-sized */
  isMobile: boolean;
}

const LayoutModeContext = createContext<LayoutModeContextValue | null>(null);

/**
 * Provider for layout mode state across the kanban board feature.
 * Single source of truth for layout preference and mobile detection.
 */
export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [layoutPref, setLayoutPref] = useLocalStorage<LayoutPreference>(
    getStorageKey("UI", "LAYOUT_PREFERENCE"),
    "board"
  );

  const value = useMemo(
    () => ({
      isListLayout: isMobile || layoutPref === "list",
      layoutPref,
      setLayoutPref,
      isMobile,
    }),
    [isMobile, layoutPref, setLayoutPref]
  );

  return (
    <LayoutModeContext.Provider value={value}>
      {children}
    </LayoutModeContext.Provider>
  );
}

/**
 * Access layout mode state from the LayoutModeProvider.
 * @throws Error if used outside of LayoutModeProvider
 * @returns Layout state and setters
 * @example
 * const { isListLayout, layoutPref, setLayoutPref, isMobile } = useLayoutMode();
 * if (isListLayout) {
 *   // render collapsible column layout
 * }
 */
export function useLayoutMode() {
  const context = useContext(LayoutModeContext);
  if (!context) {
    throw new Error("useLayoutMode must be used within LayoutModeProvider");
  }
  return context;
}
