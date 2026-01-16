import { formatDuration } from "@/app/(protected)/dashboard/tasks/_utils";

interface InsightsTotalDurationProps {
  totalDuration: number;
}

/**
 * Displays the total focus time for the selected date.
 */
export function InsightsTotalDuration({
  totalDuration,
}: InsightsTotalDurationProps) {
  return (
    <div className="p-0 mb-8 px-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Total Focus Time</p>
          <p className="text-2xl font-semibold text-text-primary">
            {formatDuration(totalDuration)}
          </p>
        </div>
      </div>
    </div>
  );
}
