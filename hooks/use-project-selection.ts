"use client";

import { useCallback } from "react";
import { Project } from "@/types/board.types";

interface UseProjectSelectionProps {
  onValueChange: (projectId: string | undefined) => void;
  setOpen: (open: boolean) => void;
  resetSearch: () => void;
}

export function useProjectSelection({
  onValueChange,
  setOpen,
  resetSearch,
}: UseProjectSelectionProps) {
  const selectProject = useCallback(
    (project: Project) => {
      onValueChange(project.id);
      setOpen(false);
      resetSearch();
    },
    [onValueChange, setOpen, resetSearch]
  );

  const handleEscape = useCallback(
    (showColorPicker: boolean, searchQuery: string) => {
      if (showColorPicker) {
        return "close-color-picker";
      } else if (searchQuery) {
        return "clear-search";
      } else {
        return "close-dropdown";
      }
    },
    []
  );

  return { selectProject, handleEscape };
}
