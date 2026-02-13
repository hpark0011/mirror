"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";
import { Button } from "@feel-good/ui/primitives/button";
import { Icon } from "@feel-good/ui/components/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { cn } from "@feel-good/utils/cn";
import type { ArticleFilterState } from "../utils/article-filter";
import type { DatePreset } from "../utils/date-preset";
import { CategoryFilterContent } from "./filter/category-filter-content";
import { DateFilterContent } from "./filter/date-filter-content";
import { StatusFilterContent } from "./filter/status-filter-content";

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  this_year: "This year",
};

type ArticleFilterDropdownProps = {
  isOwner: boolean;
  categories: { name: string; count: number }[];
  filterState: ArticleFilterState;
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
  const [open, setOpen] = useState(false);

  return (
    <Tooltip>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                (open || hasActiveFilters) && "[&_svg]:text-information",
              )}
            >
              <Icon name="Line3Icon" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{open ? undefined : "Filter"}</TooltipContent>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icon name="TagFillIcon" className="size-4.5" />
              {filterState.categories.length > 0
                ? `Category (${filterState.categories.length})`
                : "Category"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-w-[240px]">
              <CategoryFilterContent
                categories={categories}
                selectedCategories={filterState.categories}
                onToggleCategory={onToggleCategory}
                onClearFilter={onClearCategories}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Icon name="CalendarFillIcon" className="size-4.5" />
              {filterState.publishedDatePreset
                ? `Published · ${
                  DATE_PRESET_LABELS[filterState.publishedDatePreset]
                }`
                : "Published"}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DateFilterContent
                value={filterState.publishedDatePreset}
                onChange={onSetPublishedDatePreset}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {isOwner && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon name="CalendarFillIcon" className="size-4.5" />
                {filterState.createdDatePreset
                  ? `Created · ${
                    DATE_PRESET_LABELS[filterState.createdDatePreset]
                  }`
                  : "Created"}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DateFilterContent
                  value={filterState.createdDatePreset}
                  onChange={onSetCreatedDatePreset}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {isOwner && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Icon name="GlobeIcon" className="size-4.5" />
                {filterState.publishedStatus
                  ? `Status · ${
                    filterState.publishedStatus === "draft"
                      ? "Draft"
                      : "Published"
                  }`
                  : "Status"}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <StatusFilterContent
                  value={filterState.publishedStatus}
                  onChange={onSetPublishedStatus}
                />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onClearAll}>
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  );
}
