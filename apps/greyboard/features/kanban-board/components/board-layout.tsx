"use client";

import { cn } from "@/lib/utils";

interface BoardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Layout container for board view with horizontal scrolling columns.
 * Fixed-height container with horizontal overflow for column navigation.
 */
export function BoardLayout({ children, className }: BoardLayoutProps) {
  return (
    <div
      className={cn(
        "min-h-screen pt-20",
        "flex flex-row overflow-x-auto p-0 pt-20",
        className
      )}
    >
      {children}
    </div>
  );
}
