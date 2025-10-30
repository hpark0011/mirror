"use client";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const TICKET_FORM_SUBTASKS_VISIBLE_STORAGE_KEY = getStorageKey(
  "TASKS",
  "TICKET_FORM_SUBTASKS_VISIBLE"
);

/**
 * Manages persistence of the sub-tasks section visibility toggle
 *
 * Returns a stateful value and setter, similar to useState, but persisted
 * to localStorage. The visibility state is remembered across sessions.
 *
 * @param initialValue - Default visibility state (typically based on whether sub-tasks exist)
 * @returns Tuple of [showSubTasks, setShowSubTasks] with same API as useState
 *
 * @example
 * const [showSubTasks, setShowSubTasks] = usePersistedSubTasksVisibility(false);
 *
 * <Button onClick={() => setShowSubTasks(!showSubTasks)}>
 *   Toggle Sub-tasks
 * </Button>
 */
export function usePersistedSubTasksVisibility(
  initialValue: boolean
): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void] {
  const [showSubTasks, setShowSubTasks] = useLocalStorage<boolean>(
    TICKET_FORM_SUBTASKS_VISIBLE_STORAGE_KEY,
    initialValue
  );

  return [showSubTasks, setShowSubTasks];
}
