"use client";

import { cn } from "@/lib/utils";
import { useLayoutMode } from "../context";

/**
 * Layout container for the kanban board that adapts between board and list views.
 * Handles horizontal scroll for board view and vertical stacking for list view.
 */
export function BoardLayoutContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isListLayout } = useLayoutMode();

  return (
    <div
      className={cn(
        // Shared base
        "min-h-screen pt-20",
        // List layout: vertical stack with scroll
        isListLayout && "flex flex-col overflow-y-auto px-4 gap-0",
        // Board layout: horizontal layout
        !isListLayout && "flex flex-row overflow-x-auto p-0 pt-20",
        className
      )}
    >
      {children}
    </div>
  );
}
