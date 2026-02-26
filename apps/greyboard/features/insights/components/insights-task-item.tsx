import { Icon } from "@/components/ui/icon";
import { formatDuration } from "@/features/timer";
import {
  getTimeEntriesForDate,
  getTicketDurationForDate,
} from "@feel-good/greyboard-core/insights";
import { getProjectColor } from "../insights.utils";
import type { Ticket, Project } from "@feel-good/greyboard-core/types";

interface InsightsTaskItemProps {
  task: Ticket;
  project: Project | null;
  selectedDate: Date;
}

/**
 * Displays a single completed task with time entries and duration.
 */
export function InsightsTaskItem({
  task,
  project,
  selectedDate,
}: InsightsTaskItemProps) {
  const timeEntries = getTimeEntriesForDate(task, selectedDate);
  const dailyDuration = getTicketDurationForDate(task, selectedDate);

  return (
    <div className="px-0.5 text-sm space-y-2">
      <div className="flex items-center justify-between w-full">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2.5">
            {project && (
              <div className="flex items-center gap-1">
                <div
                  className="size-1.5 rounded-full"
                  style={{
                    backgroundColor: getProjectColor(project.color),
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {project.name}
                </span>
              </div>
            )}
            <span className="font-medium line-clamp-1">{task.title}</span>
          </div>
        </div>
        <div>
          {timeEntries.length > 0 ? (
            <div className="space-y-1">
              {timeEntries.map((entry) => {
                const start = new Date(entry.start);
                const end = new Date(entry.end);
                const startLabel = start.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
                const endLabel = end.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });

                return (
                  <div
                    key={`${start.getTime()}-${end.getTime()}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span>
                      {startLabel} - {endLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ml-6 flex items-center gap-2 text-xs text-muted-foreground/60 italic">
              <Icon name="InfoCircleIcon" className="size-3" />
              <span>No timer data recorded</span>
            </div>
          )}
        </div>
        <span className="font-mono text-xs text-orange-400 ml-3 shrink-0">
          {formatDuration(dailyDuration)}
        </span>
      </div>
    </div>
  );
}
