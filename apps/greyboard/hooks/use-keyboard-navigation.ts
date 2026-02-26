"use client";

import { useCallback } from "react";
import { Project } from "@feel-good/greyboard-core/types";

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

      const keyHandlers = {
        ArrowDown: () => {
          e.preventDefault();
          const nextIndex = Math.min(highlightedIndex + 1, items.length - 1);
          onHighlightChange(nextIndex);
          return undefined;
        },

        ArrowUp: () => {
          e.preventDefault();
          const prevIndex = Math.max(highlightedIndex - 1, -1);
          onHighlightChange(prevIndex);
          return undefined;
        },

        Enter: () => {
          e.preventDefault();
          if (highlightedIndex >= 0) {
            onSelect(items[highlightedIndex]);
          } else if (canCreateNew) {
            onToggleColorPicker();
          }
          return undefined;
        },

        Escape: () => {
          e.preventDefault();
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
