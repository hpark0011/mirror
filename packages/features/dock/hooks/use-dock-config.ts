"use client";

import { useMemo } from "react";

import { useDock } from "../providers";
import { type DockApp } from "../lib/types";

/**
 * Hook to access dock configuration and computed values
 *
 * Provides:
 * - config: The full dock configuration
 * - sortedApps: Apps sorted by order (ascending)
 * - activeApp: The currently active app object, or undefined
 * - activeAppId: The ID of the currently active app
 * - setActiveApp: Function to set the active app by ID
 */
export function useDockConfig() {
  const { config, state, setActiveAppId } = useDock();

  const sortedApps = useMemo<DockApp[]>(
    () => [...config.apps].sort((a, b) => a.order - b.order),
    [config.apps]
  );

  const activeApp = useMemo<DockApp | undefined>(
    () => config.apps.find((app) => app.id === state.activeAppId),
    [config.apps, state.activeAppId]
  );

  return {
    config,
    sortedApps,
    activeApp,
    activeAppId: state.activeAppId,
    setActiveApp: setActiveAppId,
  };
}
