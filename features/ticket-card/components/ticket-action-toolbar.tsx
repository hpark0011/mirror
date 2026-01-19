"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TicketActionToolbarProps {
  isDragging: boolean;
  isSubTaskEditorOpen: boolean;
  onToggleSubTasks: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Action toolbar with edit, delete, and sub-tasks toggle buttons
 * Appears on hover in the top-right corner of the card
 */
export function TicketActionToolbar({
  isDragging,
  isSubTaskEditorOpen,
  onToggleSubTasks,
  onEdit,
  onDelete,
}: TicketActionToolbarProps) {
  if (isDragging) return null;

  return (
    <div
      className={cn(
        // Layout & Alignment
        "flex flex-row items-center",
        // Positioning
        "absolute top-[5px] right-[5px]",
        // Shape
        "rounded-md",
        // Background
        "bg-white dark:bg-neutral-800",
        // Border
        "border border-border-light",
        // Interactive States
        // Mobile: always visible
        "opacity-100",
        // Desktop: hover reveal
        "md:opacity-0 md:group-hover:opacity-100",
        "pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto",
        "transition-opacity"
      )}
    >
      {/* Sub-tasks toggle button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size='sm'
            variant='ghost'
            className={cn(
              // Layout & Alignment
              "flex items-center justify-center",
              // Sizing
              "h-[22px] w-7",
              // Spacing (SVG children)
              "has-[svg]:pl-0 has-[svg]:pr-0",
              // Shape
              "rounded-none rounded-l-[7px]",
              // Background
              "bg-transparent",
              // Interactive States
              "cursor-pointer",
              "hover:bg-neutral-100 dark:hover:bg-neutral-700",
              "hover:shadow-lg"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSubTasks();
            }}
          >
            <Icon
              name='ChecklistIcon'
              className={cn(
                // Sizing
                "size-4.5",
                // Typography (conditional color)
                isSubTaskEditorOpen ? "text-blue-500" : "text-icon-dark"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isSubTaskEditorOpen ? "Hide sub-tasks" : "Manage sub-tasks"}
        </TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div
        className={cn(
          // Layout
          "self-stretch",
          // Sizing
          "w-px",
          // Background
          "bg-border-light"
        )}
      />

      {/* Edit button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size='sm'
            variant='ghost'
            className={cn(
              // Layout & Alignment
              "flex items-center justify-center",
              // Sizing
              "h-[22px] w-7",
              // Spacing (SVG children)
              "has-[svg]:pl-0 has-[svg]:pr-0",
              // Shape
              "rounded-none",
              // Background
              "bg-transparent",
              // Interactive States
              "cursor-pointer",
              "hover:bg-neutral-100 dark:hover:bg-neutral-700",
              "hover:shadow-lg"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
          >
            <Icon
              name='PencilIcon'
              className={cn(
                // Sizing
                "size-4.5",
                // Typography
                "text-icon-dark"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit Ticket</TooltipContent>
      </Tooltip>

      {/* Divider */}
      <div
        className={cn(
          // Layout
          "self-stretch",
          // Sizing
          "w-px",
          // Background
          "bg-border-light"
        )}
      />

      {/* Delete button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size='sm'
            variant='ghost'
            className={cn(
              // Layout & Alignment
              "flex items-center justify-center",
              // Sizing
              "h-[22px] w-7",
              // Spacing (SVG children)
              "has-[svg]:pl-0 has-[svg]:pr-0",
              // Shape
              "rounded-none rounded-r-[7px]",
              // Background
              "bg-transparent",
              // Interactive States
              "cursor-pointer",
              "hover:bg-neutral-100 dark:hover:bg-neutral-700",
              "hover:shadow-lg"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            <Icon
              name='TrashIcon'
              className={cn(
                // Sizing
                "size-4",
                // Typography
                "text-icon-dark"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete Ticket</TooltipContent>
      </Tooltip>
    </div>
  );
}
