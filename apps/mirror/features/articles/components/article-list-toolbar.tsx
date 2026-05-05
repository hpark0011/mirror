"use client";

import { Icon } from "@feel-good/ui/components/icon";
import {
  AlertDialog,
  AlertDialogTrigger,
} from "@feel-good/ui/primitives/alert-dialog";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";
import { useState } from "react";
import {
  ContentToolbarShell,
  type SortOrder,
  type UseContentSearchReturn,
} from "@/features/content";
import type { UseArticleFilterReturn } from "../hooks/use-article-filter";
import type { ArticleSummary } from "../types";
import { ArticleFilterDropdown } from "./article-filter-dropdown";
import { ArticleSearchInput } from "./article-search-input";
import { ArticleSortDropdown } from "./article-sort-dropdown";
import { DeleteArticlesDialog } from "./delete-articles-dialog";

type ArticleListToolbarProps = {
  isOwner: boolean;
  selectedCount: number;
  onDelete: () => void;
  onNew: () => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UseContentSearchReturn<ArticleSummary>;
  categories: { name: string; count: number }[];
  filter: UseArticleFilterReturn;
};

export function ArticleListToolbar({
  isOwner,
  selectedCount,
  onDelete,
  onNew,
  sortOrder,
  onSortChange,
  search,
  categories,
  filter,
}: ArticleListToolbarProps) {
  const hasSelection = selectedCount > 0;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <ContentToolbarShell>
      <div className="flex items-center justify-end w-full gap-3">
        {isOwner && (
          <div className="flex items-center">
            {hasSelection && (
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
            )}
          </div>
        )}

        <div className="flex items-center">
          {/* Delete */}
          {isOwner && (
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <DeleteArticlesDialog
                count={selectedCount}
                onConfirm={onDelete}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={!hasSelection}
                      aria-label={hasSelection
                        ? `Delete ${selectedCount} selected`
                        : "Delete"}
                      className={cn(isDeleteOpen && "[&_svg]:text-information")}
                    >
                      <Icon name="TrashFillIcon" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </AlertDialog>
          )}

          {/* Search */}
          <ArticleSearchInput
            query={search.query}
            onQueryChange={search.setQuery}
            isOpen={search.isOpen}
            onOpen={search.open}
            onClose={search.close}
          />

          {/* Sort */}
          <ArticleSortDropdown value={sortOrder} onChange={onSortChange} />

          {/* Filter */}
          <ArticleFilterDropdown
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
              size="xs"
              data-testid="new-article-btn"
              onClick={onNew}
              className="ml-2 has-[>svg]:gap-0.5 has-[>svg]:pl-1 has-[>svg]:pr-2"
            >
              <Icon name="PlusIcon" className="size-4 text-icon-light" />
              New
            </Button>
          )}
        </div>
      </div>
    </ContentToolbarShell>
  );
}
