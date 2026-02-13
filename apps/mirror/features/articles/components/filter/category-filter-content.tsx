"use client";

import { useState, useMemo } from "react";
import { DropdownMenuSeparator } from "@feel-good/ui/primitives/dropdown-menu";
import { CategoryFilterSearch } from "./category-filter-search";
import { CategoryFilterBadges } from "./category-filter-badges";
import { CategoryFilterList } from "./category-filter-list";

type CategoryFilterContentProps = {
  categories: { name: string; count: number }[];
  selectedCategories: string[];
  onToggleCategory: (name: string) => void;
  onClearFilter: () => void;
};

export function CategoryFilterContent({
  categories,
  selectedCategories,
  onToggleCategory,
  onClearFilter,
}: CategoryFilterContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [categories, searchQuery]
  );

  return (
    <>
      <CategoryFilterSearch value={searchQuery} onChange={setSearchQuery} />
      <DropdownMenuSeparator />
      <CategoryFilterBadges
        selectedCategories={selectedCategories}
        onRemove={onToggleCategory}
        onClearFilter={onClearFilter}
      />
      {selectedCategories.length > 0 && <DropdownMenuSeparator />}
      <CategoryFilterList
        categories={filteredCategories}
        selectedCategories={selectedCategories}
        onToggle={onToggleCategory}
      />
    </>
  );
}
