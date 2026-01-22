"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface SubTaskDeleteButtonProps {
  onDelete: () => void;
  className?: string;
}

/**
 * Delete button for sub-task rows.
 * Reveals on hover within parent group/subtask.
 */
export function SubTaskDeleteButton({
  onDelete,
  className,
}: SubTaskDeleteButtonProps) {
  return (
    <Button
      type='button'
      variant='icon'
      size='sm'
      onClick={onDelete}
      className={cn(
        // Sizing
        "h-5",
        // Shape
        "rounded-none",
        // Typography / Icon color
        "text-icon-light",
        // Visibility
        "opacity-0 group-hover/sub-task:opacity-100",
        // Interactive states
        "hover:text-icon-primary hover:text-blue-500 hover:bg-transparent",
        className
      )}
    >
      <Icon name='XmarkIcon' className='size-3.5' />
    </Button>
  );
}
