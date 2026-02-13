"use client";

import { Input } from "@feel-good/ui/primitives/input";
import { cn } from "@feel-good/utils/cn";

type CategoryFilterSearchProps = {
  value: string;
  onChange: (query: string) => void;
};

export function CategoryFilterSearch({
  value,
  onChange,
}: CategoryFilterSearchProps) {
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
        "h-6 border-none focus-visible:ring-0 px-1.5 dark:bg-transparent mb-px text-[13px] placeholder:text-[13px]",
      )}
    />
  );
}
