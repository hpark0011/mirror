"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { DatePreset } from "@/features/content";
import {
  INITIAL_POST_FILTER_STATE,
  type PostFilterState,
} from "../utils/post-filter";

export type UsePostFilterReturn = {
  filterState: PostFilterState;
  toggleCategory: (name: string) => void;
  clearCategories: () => void;
  setPublishedDatePreset: (preset: DatePreset | null) => void;
  setCreatedDatePreset: (preset: DatePreset | null) => void;
  setPublishedStatus: (status: "draft" | "published" | null) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
};

export function usePostFilter(): UsePostFilterReturn {
  const [filterState, setFilterState] = useLocalStorage(
    "mirror.posts.filter",
    INITIAL_POST_FILTER_STATE,
  );

  const toggleCategory = useCallback(
    (name: string) => {
      setFilterState((previousState) => ({
        ...previousState,
        categories: previousState.categories.includes(name)
          ? previousState.categories.filter((category) => category !== name)
          : [...previousState.categories, name],
      }));
    },
    [setFilterState],
  );

  const setPublishedDatePreset = useCallback(
    (preset: DatePreset | null) => {
      setFilterState((previousState) => ({
        ...previousState,
        publishedDatePreset: preset,
      }));
    },
    [setFilterState],
  );

  const setCreatedDatePreset = useCallback(
    (preset: DatePreset | null) => {
      setFilterState((previousState) => ({
        ...previousState,
        createdDatePreset: preset,
      }));
    },
    [setFilterState],
  );

  const setPublishedStatus = useCallback(
    (status: "draft" | "published" | null) => {
      setFilterState((previousState) => ({
        ...previousState,
        publishedStatus: status,
      }));
    },
    [setFilterState],
  );

  const clearCategories = useCallback(() => {
    setFilterState((previousState) => ({ ...previousState, categories: [] }));
  }, [setFilterState]);

  const clearAll = useCallback(() => {
    setFilterState(INITIAL_POST_FILTER_STATE);
  }, [setFilterState]);

  const hasActiveFilters = useMemo(
    () =>
      filterState.categories.length > 0 ||
      filterState.publishedDatePreset !== null ||
      filterState.createdDatePreset !== null ||
      filterState.publishedStatus !== null,
    [filterState],
  );

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
