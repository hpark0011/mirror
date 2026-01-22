import { Icon } from "@/components/ui/icon";

interface InsightsEmptyStateProps {
  message?: string;
}

/**
 * Empty state display when no tasks are completed on selected date.
 */
export function InsightsEmptyState({
  message = "No tasks completed on this day",
}: InsightsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon
        name="CalendarFillIcon"
        className="size-12 text-muted-foreground/50 mb-3"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
