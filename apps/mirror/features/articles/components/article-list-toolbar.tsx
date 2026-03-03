"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogTrigger,
} from "@feel-good/ui/primitives/alert-dialog";
import { Button } from "@feel-good/ui/primitives/button";
import { Icon } from "@feel-good/ui/components/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";
import { DeleteArticlesDialog } from "./delete-articles-dialog";
import { ArticleSortDropdown } from "./article-sort-dropdown";
import { ArticleSearchInput } from "./article-search-input";
import { ArticleFilterDropdown } from "./article-filter-dropdown";
import type { SortOrder } from "../hooks/use-article-sort";
import type { UseArticleFilterReturn } from "../hooks/use-article-filter";
import type { UseArticleSearchReturn } from "../hooks/use-article-search";

type ArticleListToolbarProps = {
  isOwner: boolean;
  selectedCount: number;
  onDelete: () => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UseArticleSearchReturn;
  categories: { name: string; count: number }[];
  filter: UseArticleFilterReturn;
};

export function ArticleListToolbar({
  isOwner,
  selectedCount,
  onDelete,
  sortOrder,
  onSortChange,
  search,
  categories,
  filter,
}: ArticleListToolbarProps) {
  const hasSelection = selectedCount > 0;
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <div className="flex h-10 items-center gap-2 px-4.5 justify-end bg-background">
      <div
        className={cn(
          "flex items-center justify-end w-full gap-3",
        )}
      >
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
              <DeleteArticlesDialog count={selectedCount} onConfirm={onDelete} />
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
              size="sm"
              className="has-[>svg]:gap-0.5 has-[>svg]:pl-1.5 ml-2"
            >
              <Icon name="PlusIcon" className="text-icon-light size-4.5" />
              New
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
