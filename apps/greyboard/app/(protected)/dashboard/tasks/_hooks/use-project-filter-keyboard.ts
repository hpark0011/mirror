"use client";

import { type KeyboardEvent, useEffect, useState } from "react";
import type { Project } from "@feel-good/greyboard-core/types";

interface UseProjectFilterKeyboardProps {
  filteredProjects: Project[];
  searchQuery: string;
  toggleProject: (projectId: string) => void;
  onClearSearch: () => void;
  onClose: () => void;
}

/**
 * Manages keyboard navigation for the project filter dropdown.
 *
 * Handles arrow key navigation, Enter to select, and Escape to close/clear.
 * Automatically resets highlight when search query changes.
 *
 * @param filteredProjects - List of projects currently visible after filtering
 * @param searchQuery - Current search query value
 * @param toggleProject - Function to toggle project selection
 * @param onClearSearch - Function to clear the search query
 * @param onClose - Function to close the popover
 *
 * @returns Object containing highlighted index state and keyboard event handler
 *
 * @example
 * const { highlightedIndex, setHighlightedIndex, handleKeyDown } = useProjectFilterKeyboard({
 *   filteredProjects,
 *   searchQuery,
 *   toggleProject,
 *   onClose,
 * });
 */
export function useProjectFilterKeyboard({
  filteredProjects,
  searchQuery,
  toggleProject,
  onClearSearch,
  onClose,
}: UseProjectFilterKeyboardProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Reset highlighted index when search changes (only if currently highlighted)
  useEffect(() => {
    if (highlightedIndex !== -1) {
      setHighlightedIndex(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredProjects.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredProjects[highlightedIndex]) {
          toggleProject(filteredProjects[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        if (searchQuery) {
          // Clear search if there's a query
          onClearSearch();
          setHighlightedIndex(-1);
        } else {
          // Close popover if no query
          onClose();
        }
        break;
    }
  };

  return {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
  };
}
