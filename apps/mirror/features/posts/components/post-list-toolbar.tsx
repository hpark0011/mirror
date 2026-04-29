"use client";

import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import {
  ContentListFilterDropdown,
  ContentListSearchInput,
  ContentListSortDropdown,
  type SortOrder,
  type UseContentSearchReturn,
} from "@/features/content";
import type { PostSummary } from "../types";
import type { UsePostFilterReturn } from "../hooks/use-post-filter";
import { PostCategoryFilterRow } from "./post-category-filter-row";

type PostListToolbarProps = {
  isOwner: boolean;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UseContentSearchReturn<PostSummary>;
  categories: { name: string; count: number }[];
  filter: UsePostFilterReturn;
  onUploadClick: () => void;
};

export function PostListToolbar({
  isOwner,
  sortOrder,
  onSortChange,
  search,
  categories,
  filter,
  onUploadClick,
}: PostListToolbarProps) {
  return (
    <div className="flex h-9 gap-3 pl-[14px] px-3.5 md:justify-start justify-end items-start bg-background relative border-b border-border-subtle">
      <PostCategoryFilterRow
        categories={categories}
        selectedCategories={filter.filterState.categories}
        onToggleCategory={filter.toggleCategory}
      />
      <div className="flex w-fit items-center justify-end gap-0">
        <div className="flex items-center gap-0 bg-background rounded-sm">
          <ContentListSearchInput
            query={search.query}
            onQueryChange={search.setQuery}
            isOpen={search.isOpen}
            onOpen={search.open}
            onClose={search.close}
            ariaLabel="Search posts"
          />
          <ContentListSortDropdown value={sortOrder} onChange={onSortChange} />
          <ContentListFilterDropdown
            isOwner={isOwner}
            categories={categories}
            filterState={filter.filterState}
            hasActiveFilters={filter.hasActiveFilters}
            onToggleCategory={filter.toggleCategory}
            onSetPublishedDatePreset={filter.setPublishedDatePreset}
            onSetCreatedDatePreset={filter.setCreatedDatePreset}
            onSetPublishedStatus={filter.setPublishedStatus}
            onClearAll={filter.clearAll}
            onClearCategories={filter.clearCategories}
            categoryDropdownVisibility="mobile-only"
          />
        </div>

        {isOwner && (
          <Button
            variant="primary"
            size="xs"
            className="ml-2 has-[>svg]:gap-0.5 has-[>svg]:pl-1 has-[>svg]:pr-2"
            onClick={onUploadClick}
            data-testid="new-post-btn"
          >
            <Icon name="PlusIcon" className="size-4 text-icon-light" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}
