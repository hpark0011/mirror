import type React from "react";
import { cn } from "@/lib/utils";

type SubTaskRowWrapperProps = React.ComponentProps<"div">;

/**
 * Sub-task wrapper container.
 * Provides layout and hover states.
 * Overrides --sub-task-bg CSS variable on hover for contextual background matching.
 */
export function SubTaskRowWrapper({
  className,
  ...props
}: SubTaskRowWrapperProps) {
  return (
    <div
      data-slot='sub-task-wrapper'
      className={cn(
        "relative flex items-center gap-2 pl-2 pr-1",
        "group/sub-task",
        // Override parent's --sub-task-bg variable on row hover
        "hover:[--sub-task-bg:var(--color-hover)] hover:bg-hover",
        className
      )}
      {...props}
    />
  );
}
