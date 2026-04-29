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
      <button
        type="button"
        onClick={() => {
          if (!isAllChecked) onClearCategories();
        }}
        aria-pressed={isAllChecked}
        className="h-9 pb-1.5 flex items-center gap-1 text-[13px] cursor-pointer"
      >
        <Checkbox
          checked={isAllChecked}
          className="pointer-events-none size-4"
          tabIndex={-1}
        />
        All
      </button>
      {categories.map((category) => {
        const isChecked = selectedCategories.includes(category.name);
        return (
          <button
            key={category.name}
            type="button"
            onClick={() => onToggleCategory(category.name)}
            aria-pressed={isChecked}
            className="h-9 pb-1.5 flex items-center gap-1 text-[13px] cursor-pointer"
          >
            <Checkbox
              checked={isChecked}
              className="pointer-events-none size-4"
              tabIndex={-1}
            />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
