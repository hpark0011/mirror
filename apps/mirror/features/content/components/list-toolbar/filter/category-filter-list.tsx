import { useMemo } from "react";
import { DropdownMenuCheckboxItem } from "@feel-good/ui/primitives/dropdown-menu";

type ContentCategoryFilterListProps = {
  categories: { name: string; count: number }[];
  selectedCategories: string[];
  onToggle: (name: string) => void;
};

export function ContentCategoryFilterList({
  categories,
  selectedCategories,
  onToggle,
}: ContentCategoryFilterListProps) {
  const selectedSet = useMemo(
    () => new Set(selectedCategories),
    [selectedCategories],
  );

  if (categories.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-sm text-muted-foreground">
        No categories found
      </p>
    );
  }

  return (
    <div className="max-h-[200px] overflow-y-auto">
      {categories.map((category) => (
        <DropdownMenuCheckboxItem
          key={category.name}
          checked={selectedSet.has(category.name)}
          onCheckedChange={() => onToggle(category.name)}
          onSelect={(e) => e.preventDefault()}
        >
          <span className="flex-1">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            {category.count}
          </span>
        </DropdownMenuCheckboxItem>
      ))}
    </div>
  );
}
