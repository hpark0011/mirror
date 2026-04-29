"use client";

import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import { cn } from "@feel-good/utils/cn";

type PostCategoryFilterRowProps = {
  categories: { name: string; count: number }[];
  selectedCategories: string[];
  onToggleCategory: (name: string) => void;
  onClearCategories: () => void;
};

export function PostCategoryFilterRow({
  categories,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
}: PostCategoryFilterRowProps) {
  const isAllChecked = selectedCategories.length === 0;

  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-3 w-full",
        "overflow-x-auto whitespace-nowrap min-w-0",
      )}
    >
      <label className="h-9 pb-1.5 flex items-center gap-1 text-[13px] cursor-pointer select-none">
        <Checkbox
          checked={isAllChecked}
          onCheckedChange={() => {
            if (!isAllChecked) onClearCategories();
          }}
          className="size-4"
        />
        All
      </label>
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
