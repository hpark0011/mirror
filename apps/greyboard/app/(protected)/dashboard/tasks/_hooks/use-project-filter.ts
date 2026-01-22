"use client";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const PROJECT_FILTER_STORAGE_KEY = getStorageKey("TASKS", "PROJECT_FILTER");

/**
 * Manages the project filter state for the task board.
 *
 * Stores selected project IDs in localStorage and provides methods to
 * toggle project selection and clear all filters.
 *
 * @returns Object containing selected project IDs and filter management functions
 *
 * @example
 * const { selectedProjectIds, toggleProject, clearFilter } = useProjectFilter();
 *
 * // Toggle a project in the filter
 * toggleProject("project-123");
 *
 * // Clear all filters
 * clearFilter();
 */
export function useProjectFilter() {
  const [selectedProjectIds, setSelectedProjectIds] = useLocalStorage<string[]>(
    PROJECT_FILTER_STORAGE_KEY,
    []
  );

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const clearFilter = () => {
    setSelectedProjectIds([]);
  };

  return {
    selectedProjectIds,
    toggleProject,
    clearFilter,
  };
}
