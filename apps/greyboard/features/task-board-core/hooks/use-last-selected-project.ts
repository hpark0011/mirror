"use client";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const LAST_SELECTED_PROJECT_STORAGE_KEY = getStorageKey(
  "TASKS",
  "LAST_SELECTED_PROJECT"
);

export function useLastSelectedProject() {
  const [lastSelectedProjectId, setLastSelectedProjectId] = useLocalStorage<
    string | undefined
  >(LAST_SELECTED_PROJECT_STORAGE_KEY, undefined);

  return {
    lastSelectedProjectId,
    setLastSelectedProjectId,
  };
}
