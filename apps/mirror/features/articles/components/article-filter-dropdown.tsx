"use client";

import {
  ContentListFilterDropdown,
  type ContentFilterState,
  type DatePreset,
} from "@/features/content";

type ArticleFilterDropdownProps = {
  isOwner: boolean;
  categories: { name: string; count: number }[];
  filterState: ContentFilterState;
  hasActiveFilters: boolean;
  onToggleCategory: (name: string) => void;
  onSetPublishedDatePreset: (preset: DatePreset | null) => void;
  onSetCreatedDatePreset: (preset: DatePreset | null) => void;
  onSetPublishedStatus: (status: "draft" | "published" | null) => void;
  onClearAll: () => void;
  onClearCategories: () => void;
};


export function ArticleFilterDropdown({
  isOwner,
  categories,
  filterState,
  hasActiveFilters,
  onToggleCategory,
  onSetPublishedDatePreset,
  onSetCreatedDatePreset,
  onSetPublishedStatus,
  onClearAll,
  onClearCategories,
}: ArticleFilterDropdownProps) {
  return (
    <ContentListFilterDropdown
      isOwner={isOwner}
      categories={categories}
      filterState={filterState}
      hasActiveFilters={hasActiveFilters}
      onToggleCategory={onToggleCategory}
      onSetPublishedDatePreset={onSetPublishedDatePreset}
      onSetCreatedDatePreset={onSetCreatedDatePreset}
      onSetPublishedStatus={onSetPublishedStatus}
      onClearAll={onClearAll}
      onClearCategories={onClearCategories}
    />
  );
}
