import { type ComponentType } from "react";

/**
 * Dock placement position
 * Currently supports 'bottom', extensible for future positions
 */
export type DockPlacement = "bottom";

/**
 * Represents an application in the dock
 */
export interface DockApp {
  /** Unique identifier for the app */
  id: string;
  /** Display name shown in tooltip */
  name: string;
  /** Icon component to render */
  icon: ComponentType<{ className?: string }>;
  /** Navigation route when clicked */
  route: string;
  /** Sort order (lower = left) */
  order: number;
}

/**
 * Configuration for the dock
 */
export interface DockConfig {
  /** Position of the dock on screen */
  placement: DockPlacement;
  /** List of apps to display in the dock */
  apps: DockApp[];
  /** ID of the default active app */
  defaultAppId: string;
}

/**
 * Runtime state of the dock
 */
export interface DockState {
  /** Whether the dock is currently visible */
  isVisible: boolean;
  /** ID of the currently active app, null if none */
  activeAppId: string | null;
}

/**
 * Context value combining config, state, and setters
 */
export interface DockContextValue {
  /** Dock configuration */
  config: DockConfig;
  /** Current dock state */
  state: DockState;
  /** Set the active app by ID */
  setActiveAppId: (appId: string | null) => void;
  /** Set dock visibility */
  setIsVisible: (isVisible: boolean) => void;
}
