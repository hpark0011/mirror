import type React from "react";
import { cn } from "@/lib/utils";

interface SubTaskFadeOverlayProps {
  /** Content to render inside the fade overlay */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Positioned fade overlay for sub-task rows.
 * Combines absolute positioning with gradient fade effect.
 * Uses --sub-task-bg CSS variable to match parent/row background contextually.
 */
export function SubTaskFadeOverlay({
  children,
  className,
}: SubTaskFadeOverlayProps) {
  return (
    <div
      className={cn(
        // Positioning - fill vertical space and align to right
        "absolute inset-y-0 right-0 z-20",
        // Spacing - expand on hover for button visibility
        "pl-0 group-hover/sub-task:pl-2",
        className
      )}
    >
      <div
        className={cn(
          // Sizing - match input height
          "h-5",
          // Layout - center content vertically
          "flex items-center",
          // Background - gradient fade using CSS variable
          "bg-gradient-to-r from-transparent via-[var(--sub-task-bg)] to-[var(--sub-task-bg)]"
        )}
      >
        {children}
      </div>
    </div>
  );
}
