"use client";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const PROJECT_FILTER_STORAGE_KEY = getStorageKey("TASKS", "PROJECT_FILTER");

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
