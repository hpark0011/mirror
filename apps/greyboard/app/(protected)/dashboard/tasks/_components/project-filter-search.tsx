"use client";

import { type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

interface ProjectFilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Search input for filtering projects in the project filter dropdown.
 *
 * @param value - Current search query value
 * @param onChange - Handler called when input value changes
 * @param onKeyDown - Handler for keyboard events (arrow keys, enter, escape)
 */
export function ProjectFilterSearch({
  value,
  onChange,
  onKeyDown,
}: ProjectFilterSearchProps) {
  return (
    <>
      <Input
        placeholder="Filter by projects..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-8 border-none"
        autoFocus={false}
      />
      <div className="h-px bg-border-light w-full" />
    </>
  );
}
