import type React from "react";
import { RingPercentage } from "@/components/ring-percentage";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface SubTasksListHeaderProps extends React.ComponentProps<"div"> {
  completed: number;
  total: number;
}

/**
 * Header component displaying subtask progress.
 * Shows ring percentage and completion count.
 */
export function SubTasksListHeader({
  completed,
  total,
  className,
  ...props
}: SubTasksListHeaderProps) {
  const hasSubTasks = total > 0;
  const completionPercentage = hasSubTasks
    ? Math.round((completed / total) * 100)
    : 0;

  return (
    <div
      data-slot='subtasks-list-header'
      className={cn(
        "text-xs text-text-muted px-2 mb-2 pt-1.5 flex items-center gap-1.5",
        className
      )}
      {...props}
    >
      {hasSubTasks ? (
        <>
          <div className='flex items-center justify-center pt-[1px] pl-0.5'>
            <RingPercentage
              value={completionPercentage}
              size={12}
              strokeWidth={2}
              ariaLabel='Sub-task completion'
              showLabel={false}
            />
          </div>
          <span className='text-xs text-text-muted'>
            {completed} / {total} Completed
          </span>
        </>
      ) : (
        <>
          <Icon name='ChecklistIcon' className='size-3.5' />
          <span className='text-xs text-text-muted'>Sub-tasks</span>
        </>
      )}
    </div>
  );
}
