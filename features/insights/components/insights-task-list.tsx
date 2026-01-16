import { InsightsTaskItem } from "./insights-task-item";
import type { Ticket, Project } from "@/types/board.types";

interface InsightsTaskListProps {
  completedTasks: Ticket[];
  projects: Project[];
  selectedDate: Date;
}

/**
 * Displays the list of completed tasks for the selected date.
 */
export function InsightsTaskList({
  completedTasks,
  projects,
  selectedDate,
}: InsightsTaskListProps) {
  return (
    <div className="space-y-2 px-4">
      <h4 className="text-xs font-medium text-muted-foreground mb-3">
        Completed Tasks
      </h4>
      <div className="max-h-64 space-y-1.5 2overflow-y-auto">
        {completedTasks.map((task) => {
          const project = task.projectId
            ? projects.find((p) => p.id === task.projectId) ?? null
            : null;

          return (
            <InsightsTaskItem
              key={task.id}
              task={task}
              project={project}
              selectedDate={selectedDate}
            />
          );
        })}
      </div>
    </div>
  );
}
