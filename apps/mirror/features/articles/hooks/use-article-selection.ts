"use client";

import { useState, useCallback, useMemo } from "react";

export function useArticleSelection(allSlugs: string[]) {
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(
    () => new Set(),
  );

  const toggle = useCallback((slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedSlugs((prev) =>
      prev.size === allSlugs.length
        ? new Set()
        : new Set(allSlugs),
    );
  }, [allSlugs]);

  const clear = useCallback(() => {
    setSelectedSlugs(new Set());
  }, []);

  const count = selectedSlugs.size;
  const isAllSelected = count > 0 && count === allSlugs.length;
  const isIndeterminate = count > 0 && count < allSlugs.length;

  const isSelected = useCallback(
    (slug: string) => selectedSlugs.has(slug),
    [selectedSlugs],
  );

  return useMemo(
    () => ({
      selectedSlugs,
      toggle,
      toggleAll,
      clear,
      count,
      isAllSelected,
      isIndeterminate,
      isSelected,
    }),
    [selectedSlugs, toggle, toggleAll, clear, count, isAllSelected, isIndeterminate, isSelected],
  );
}
