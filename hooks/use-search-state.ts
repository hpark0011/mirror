"use client";

import { useCallback, useState } from "react";

export function useSearchState() {
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const resetSearch = useCallback(() => {
    setSearchQuery("");
    setHighlightedIndex(-1);
    setShowColorPicker(false);
  }, []);

  const updateHighlightedIndex = useCallback((index: number) => {
    setHighlightedIndex(index);
  }, []);

  const toggleColorPicker = useCallback(() => {
    setShowColorPicker((prev) => !prev);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    highlightedIndex,
    updateHighlightedIndex,
    showColorPicker,
    toggleColorPicker,
    resetSearch,
  };
}
