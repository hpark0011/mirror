"use client";

import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import { cn } from "@feel-good/utils/cn";

type PostCategoryFilterRowProps = {
  categories: { name: string; count: number }[];
  selectedCategories: string[];
  onToggleCategory: (name: string) => void;
};

export function PostCategoryFilterRow({
  categories,
  selectedCategories,
  onToggleCategory,
}: PostCategoryFilterRowProps) {
  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-3 w-full",
        "overflow-x-auto whitespace-nowrap min-w-0",
      )}
      role="group"
      aria-label="Filter by category"
    >
      {categories.map((category) => {
        const isChecked = selectedCategories.includes(category.name);
        return (
          <label
            key={category.name}
            className="h-9 pb-1.5 flex items-center gap-1 text-[13px] cursor-pointer select-none"
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onToggleCategory(category.name)}
              className="size-4"
            />
            {category.name}
          </label>
        );
      })}
    </div>
  );
}
