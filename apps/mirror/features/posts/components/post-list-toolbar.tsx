"use client";

import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import {
  ContentListFilterDropdown,
  ContentListSearchInput,
  ContentListSortDropdown,
} from "@/features/content";
import type { UsePostFilterReturn } from "../hooks/use-post-filter";
import type { UsePostSearchReturn } from "../hooks/use-post-search";
import type { SortOrder } from "../hooks/use-post-sort";

type PostListToolbarProps = {
  isOwner: boolean;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UsePostSearchReturn;
  categories: { name: string; count: number }[];
  filter: UsePostFilterReturn;
};

export function PostListToolbar({
  isOwner,
  sortOrder,
  onSortChange,
  search,
  categories,
  filter,
}: PostListToolbarProps) {
  return (
    <div className="relative flex h-10 items-center justify-end gap-3 bg-background px-4.5 border-b border-border-subtle">
      <div className="flex w-full items-center justify-end gap-0">
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
        />

        {isOwner && (
          <Button
            variant="primary"
            size="sm"
            className="ml-2 has-[>svg]:gap-0.5 has-[>svg]:pl-1.5"
          >
            <Icon name="PlusIcon" className="size-4.5 text-icon-light" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}
