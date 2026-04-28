"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  INITIAL_CONTENT_FILTER_STATE,
  type ContentFilterState,
  type DatePreset,
} from "@/features/content";

export type UseArticleFilterReturn = {
  filterState: ContentFilterState;
  toggleCategory: (name: string) => void;
  clearCategories: () => void;
  setPublishedDatePreset: (preset: DatePreset | null) => void;
  setCreatedDatePreset: (preset: DatePreset | null) => void;
  setPublishedStatus: (status: "draft" | "published" | null) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
};

export function useArticleFilter(): UseArticleFilterReturn {
  const [filterState, setFilterState] = useLocalStorage(
    "mirror.articles.filter",
    INITIAL_CONTENT_FILTER_STATE,
  );

  const toggleCategory = useCallback(
    (name: string) => {
      setFilterState((prev) => ({
        ...prev,
        categories: prev.categories.includes(name)
          ? prev.categories.filter((c) => c !== name)
          : [...prev.categories, name],
      }));
    },
    [setFilterState],
  );

  const setPublishedDatePreset = useCallback(
    (preset: DatePreset | null) => {
      setFilterState((prev) => ({
        ...prev,
        publishedDatePreset: preset,
      }));
    },
    [setFilterState],
  );

  const setCreatedDatePreset = useCallback(
    (preset: DatePreset | null) => {
      setFilterState((prev) => ({
        ...prev,
        createdDatePreset: preset,
      }));
    },
    [setFilterState],
  );

  const setPublishedStatus = useCallback(
    (status: "draft" | "published" | null) => {
      setFilterState((prev) => ({
        ...prev,
        publishedStatus: status,
      }));
    },
    [setFilterState],
  );

  const clearCategories = useCallback(() => {
    setFilterState((prev) => ({ ...prev, categories: [] }));
  }, [setFilterState]);

  const clearAll = useCallback(() => {
    setFilterState(INITIAL_CONTENT_FILTER_STATE);
  }, [setFilterState]);

  const hasActiveFilters = useMemo(() => {
    return (
      filterState.categories.length > 0 ||
      filterState.publishedDatePreset !== null ||
      filterState.createdDatePreset !== null ||
      filterState.publishedStatus !== null
    );
  }, [filterState]);

  return useMemo(
    () => ({
      filterState,
      toggleCategory,
      clearCategories,
      setPublishedDatePreset,
      setCreatedDatePreset,
      setPublishedStatus,
      clearAll,
      hasActiveFilters,
    }),
    [
      filterState,
      toggleCategory,
      clearCategories,
      setPublishedDatePreset,
      setCreatedDatePreset,
      setPublishedStatus,
      clearAll,
      hasActiveFilters,
    ],
  );
}
