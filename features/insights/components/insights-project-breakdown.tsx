import { formatDuration } from "@/app/(protected)/dashboard/tasks/_utils";
import { cn } from "@/lib/utils";
import { getProjectColor } from "../insights.utils";

interface ProjectBreakdownItem {
  projectId: string | null;
  projectName: string;
  projectColor: string;
  taskCount: number;
  duration: number;
}

interface InsightsProjectBreakdownProps {
  projectBreakdown: ProjectBreakdownItem[];
}

/**
 * Displays breakdown of focus time by project.
 */
export function InsightsProjectBreakdown({
  projectBreakdown,
}: InsightsProjectBreakdownProps) {
  if (projectBreakdown.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-8 px-4">
      <h4 className="text-xs font-medium text-muted-foreground mb-3">
        By Project
      </h4>
      <div className="space-y-2">
        {projectBreakdown.map((project) => (
          <div
            key={project.projectId || "unassigned"}
            className="flex items-center justify-between px-0.5 text-sm"
          >
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn("size-1.5 rounded-full")}
                  style={{
                    backgroundColor: getProjectColor(project.projectColor),
                  }}
                />
                <span className="font-medium text-xs text-muted-foreground">
                  {project.projectName}
                </span>
              </div>
              <span className="text-xs">
                ({project.taskCount} {project.taskCount === 1 ? "task" : "tasks"}
                )
              </span>
            </div>
            <span className="font-mono text-xs text-orange-400">
              {formatDuration(project.duration)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
