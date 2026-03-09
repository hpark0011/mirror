"use client";

import { Input } from "@feel-good/ui/primitives/input";
import { cn } from "@feel-good/utils/cn";

type ContentCategoryFilterSearchProps = {
  value: string;
  onChange: (query: string) => void;
};

export function ContentCategoryFilterSearch({
  value,
  onChange,
}: ContentCategoryFilterSearchProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Input
      type="text"
      placeholder="Search categories..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      className={cn(
        "mb-px h-6 border-none px-1.5 text-[13px] placeholder:text-[13px] focus-visible:ring-0 dark:bg-transparent",
      )}
    />
  );
}
