"use client";

import { useCallback } from "react";
import { Project } from "@/types/board.types";

interface UseKeyboardNavigationProps {
  items: Project[];
  highlightedIndex: number;
  onHighlightChange: (index: number) => void;
  onSelect: (item: Project) => void;
  canCreateNew: boolean;
  onToggleColorPicker: () => void;
}

export function useKeyboardNavigation({
  items,
  highlightedIndex,
  onHighlightChange,
  onSelect,
  canCreateNew,
  onToggleColorPicker,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const { key } = e;

      // Prevent default behavior for all handled keys
      e.preventDefault();

      const keyHandlers = {
        ArrowDown: () => {
          const nextIndex = Math.min(highlightedIndex + 1, items.length - 1);
          onHighlightChange(nextIndex);
          return undefined;
        },

        ArrowUp: () => {
          const prevIndex = Math.max(highlightedIndex - 1, -1);
          onHighlightChange(prevIndex);
          return undefined;
        },

        Enter: () => {
          if (highlightedIndex >= 0) {
            onSelect(items[highlightedIndex]);
          } else if (canCreateNew) {
            onToggleColorPicker();
          }
          return undefined;
        },

        Escape: () => {
          // This will be handled by the parent component
          return "escape";
        },
      };

      const handler = keyHandlers[key as keyof typeof keyHandlers];
      return handler?.();
    },
    [
      highlightedIndex,
      items,
      onHighlightChange,
      onSelect,
      canCreateNew,
      onToggleColorPicker,
    ]
  );

  return { handleKeyDown };
}
