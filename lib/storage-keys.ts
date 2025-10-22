/**
 * Centralized localStorage key management system
 *
 * Benefits:
 * - Type-safe key access throughout the application
 * - Single source of truth for all storage keys
 * - Easy refactoring and key renaming
 * - Namespace isolation to prevent collisions
 * - Documentation of all storage keys in one place
 */

// Application namespace prefix to prevent conflicts with other apps/libraries
const APP_PREFIX = "docgen";

// Version for potential future key migrations
const KEY_VERSION = "v1";

/**
 * Storage key categories organized by feature module
 *
 * Note: Only contains keys that are currently in use or documented for immediate implementation.
 * New keys should be added only when the feature is being implemented (YAGNI principle).
 */
const STORAGE_KEYS = {
  // Task management module
  TASKS: {
    BOARD_STATE: `${APP_PREFIX}.${KEY_VERSION}.tasks.board-state`,
    PROJECTS: `${APP_PREFIX}.${KEY_VERSION}.tasks.projects`,
    PROJECT_FILTER: `${APP_PREFIX}.${KEY_VERSION}.tasks.project-filter`,
  },

  // Dashboard/UI preferences
  UI: {
    TODAY_FOCUS: `${APP_PREFIX}.${KEY_VERSION}.ui.today-focus`,
    THEME: "theme", // External library key (next-themes)
  },
} as const;

/**
 * Type-safe helper to get storage key
 * @example getStorageKey('TASKS', 'BOARD_STATE') // Returns 'docgen.v1.tasks.board-state'
 */
export function getStorageKey<
  Category extends keyof typeof STORAGE_KEYS,
  Key extends keyof (typeof STORAGE_KEYS)[Category],
>(category: Category, key: Key): string {
  return STORAGE_KEYS[category][key] as string;
}
