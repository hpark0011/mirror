import type React from "react";
import { cn } from "@/lib/utils";

type SubTasksListContainerProps = React.ComponentProps<"div">;

/**
 * Container for subtasks list.
 * Provides hover states and layout structure.
 * Sets --sub-task-bg CSS variable for child components to reference.
 */
export function SubTasksListContainer({
  className,
  ...props
}: SubTasksListContainerProps) {
  return (
    <div
      data-slot='subtasks-list'
      className={cn(
        "group flex flex-col",
        // Set CSS variable for background color that children can reference
        "[--sub-task-bg:var(--color-dialog)]",
        // On hover, update variable and apply solid background
        "hover:[--sub-task-bg:var(--color-hover-subtle)]",
        "hover:bg-hover-subtle",
        className
      )}
      {...props}
    />
  );
}
