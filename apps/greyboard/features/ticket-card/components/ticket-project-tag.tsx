"use client";

import { cn } from "@/lib/utils";
import { getProjectColorBgClass } from "@/config/tasks.config";
import type { Project } from "@feel-good/greyboard-core/types";

interface TicketProjectTagProps {
  project: Project | undefined;
  isDragging: boolean;
}

/**
 * Displays a project tag above the ticket card with color indicator
 */
export function TicketProjectTag({ project, isDragging }: TicketProjectTagProps) {
  if (!project) return null;

  return (
    <div
      className={cn(
        // Positioning
        "relative",
        // Sizing
        "w-fit",
        // Spacing
        "ml-[12px]",
        // Interactive States
        "cursor-grab active:cursor-grabbing"
      )}
    >
      <div
        className={cn(
          // Layout & Alignment
          "flex items-center",
          // Sizing
          "w-fit",
          // Spacing
          "gap-[3px] px-2 pl-2 py-[1px]",
          // Positioning
          "relative",
          // Shape
          "rounded-t-md",
          // Background
          "bg-neutral-100 dark:bg-neutral-900",
          // Border
          "border border-card-border dark:border-neutral-900",
          // Interactive States
          "hover:bg-hover",
          // Pseudo-elements (after)
          'after:content-[""]',
          "after:absolute after:bottom-[-12px] after:left-0",
          "after:w-full after:h-[12px]",
          "after:bg-neutral-100 dark:after:bg-neutral-900"
        )}
      >
        <div className='flex items-center justify-center'>
          <div
            className={cn(
              // Sizing
              "size-[5px]",
              // Spacing
              "mr-[1px]",
              // Shape
              "rounded-full",
              // Background (project color)
              getProjectColorBgClass(project.color)
            )}
          />
        </div>
        <span
          className={cn(
            // Typography
            "text-xs text-text-tertiary"
          )}
        >
          {project.name}
        </span>
      </div>
      {/* Left corner ornament */}
      <div
        className={cn(
          // Positioning
          "absolute bottom-[-3px] left-[-6px]",
          // Background
          "bg-neutral-100 dark:bg-neutral-900"
        )}
      >
        <div
          className={cn(
            // Sizing
            "w-[7px] h-[8px]",
            // Shape
            "rounded-br-full",
            // Background
            "bg-background",
            // Border
            "border-r border-b border-white dark:border-neutral-900",
            // Conditional: Hide when dragging
            isDragging && "hidden"
          )}
        />
      </div>
      {/* Right corner ornament */}
      <div
        className={cn(
          // Positioning
          "absolute bottom-[-1px] right-[-7px]",
          // Background
          "bg-neutral-100 dark:bg-neutral-900"
        )}
      >
        <div
          className={cn(
            // Sizing
            "w-[8px] h-[8px]",
            // Shape
            "rounded-bl-[6px]",
            // Background
            "bg-background",
            // Border
            "border-l border-b border-white dark:border-neutral-900",
            // Conditional: Hide when dragging
            isDragging && "hidden"
          )}
        />
      </div>
    </div>
  );
}
