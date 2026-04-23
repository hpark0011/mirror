"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { DockConfig, DockContextValue, DockState } from "../lib/types";

const DockContext = createContext<DockContextValue | null>(null);

interface DockProviderProps {
  children: ReactNode;
  config: DockConfig;
  initialActiveAppId?: string;
}

/**
 * Provides dock configuration and state via React context.
 *
 * @example
 * // app/layout.tsx
 * import { DockProvider } from "@feel-good/features/dock/providers"
 *
 * const dockConfig: DockConfig = {
 *   placement: "bottom",
 *   apps: [...],
 *   defaultAppId: "home"
 * }
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <DockProvider config={dockConfig}>
 *       {children}
 *     </DockProvider>
 *   )
 * }
 */
export function DockProvider({
  children,
  config,
  initialActiveAppId,
}: DockProviderProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeAppId, setActiveAppId] = useState<string | null>(
    initialActiveAppId ?? config.defaultAppId,
  );

  const value = useMemo<DockContextValue>(
    () => ({
      config,
      state: {
        isVisible,
        activeAppId,
      } satisfies DockState,
      setActiveAppId,
      setIsVisible,
    }),
    [config, isVisible, activeAppId],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

/**
 * Access the dock context.
 * Must be used within a DockProvider.
 *
 * @throws Error if used outside of DockProvider
 */
export function useDock(): DockContextValue {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error("useDock must be used within DockProvider");
  }
  return context;
}
