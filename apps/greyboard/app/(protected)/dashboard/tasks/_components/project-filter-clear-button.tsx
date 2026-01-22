"use client";

import { type KeyboardEvent } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectFilterClearButtonProps {
  onClick: () => void;
  className?: string;
}

/**
 * Clear button component for project filter.
 *
 * Uses a span with role="button" to avoid invalid HTML nesting when used
 * inside the PopoverTrigger's Button component.
 *
 * @param onClick - Handler function called when button is clicked
 * @param className - Optional additional CSS classes
 */
export function ProjectFilterClearButton({
  onClick,
  className,
}: ProjectFilterClearButtonProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center justify-center transition-colors cursor-pointer px-1.5 group h-full hover:shadow-lg",
        className,
      )}
      aria-label="Clear filters"
    >
      <XIcon className="size-3.5 text-icon-light group-hover:text-blue-500" />
    </span>
  );
}
