"use client";

import { useMemo, useState } from "react";
import { DropdownMenuSeparator } from "@feel-good/ui/primitives/dropdown-menu";
import { ContentCategoryFilterSearch } from "./category-filter-search";
import { ContentCategoryFilterBadges } from "./category-filter-badges";
import { ContentCategoryFilterList } from "./category-filter-list";

type ContentCategoryFilterContentProps = {
  categories: { name: string; count: number }[];
  selectedCategories: string[];
  onToggleCategory: (name: string) => void;
  onClearFilter: () => void;
};

export function ContentCategoryFilterContent({
  categories,
  selectedCategories,
  onToggleCategory,
  onClearFilter,
}: ContentCategoryFilterContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        category.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [categories, searchQuery],
  );

  return (
    <>
      <ContentCategoryFilterSearch
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <DropdownMenuSeparator />
      <ContentCategoryFilterBadges
        selectedCategories={selectedCategories}
        onRemove={onToggleCategory}
        onClearFilter={onClearFilter}
      />
      {selectedCategories.length > 0 && <DropdownMenuSeparator />}
      <ContentCategoryFilterList
        categories={filteredCategories}
        selectedCategories={selectedCategories}
        onToggle={onToggleCategory}
      />
    </>
  );
}
