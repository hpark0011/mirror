"use client";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const LAST_SELECTED_PROJECT_STORAGE_KEY = getStorageKey(
  "TASKS",
  "LAST_SELECTED_PROJECT"
);

/**
 * Manages the last selected project for ticket creation.
 *
 * Stores the project ID (or undefined) in localStorage so that when users
 * create a new ticket, the project field defaults to their previous selection.
 *
 * @returns Object containing the last selected project ID and a function to update it
 *
 * @example
 * const { lastSelectedProjectId, setLastSelectedProjectId } = useLastSelectedProject();
 *
 * // Set the last selected project
 * setLastSelectedProjectId("project-123");
 *
 * // Clear the last selected project
 * setLastSelectedProjectId(undefined);
 */
export function useLastSelectedProject() {
  const [lastSelectedProjectId, setLastSelectedProjectId] = useLocalStorage<
    string | undefined
  >(LAST_SELECTED_PROJECT_STORAGE_KEY, undefined);

  return {
    lastSelectedProjectId,
    setLastSelectedProjectId,
  };
}
