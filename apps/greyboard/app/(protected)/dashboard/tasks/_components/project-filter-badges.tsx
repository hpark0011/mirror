"use client";

import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getProjectColorBgClass } from "@/config/tasks.config";
import type { Project } from "@/types/board.types";

interface ProjectFilterBadgesProps {
  selectedProjectIds: string[];
  projects: Project[];
  toggleProject: (projectId: string) => void;
  onClearFilter: () => void;
}

/**
 * Badges section showing selected projects in the filter dropdown.
 *
 * Displays individual project badges with remove buttons and a "Clear" button.
 * Only renders when there are active filters.
 *
 * @param selectedProjectIds - Array of selected project IDs
 * @param projects - All available projects
 * @param toggleProject - Handler to toggle individual project selection
 * @param onClearFilter - Handler to clear all filters
 */
export function ProjectFilterBadges({
  selectedProjectIds,
  projects,
  toggleProject,
  onClearFilter,
}: ProjectFilterBadgesProps) {
  if (selectedProjectIds.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1 p-1 flex-wrap">
        {selectedProjectIds.map((projectId) => {
          const project = projects.find((p) => p.id === projectId);
          if (!project) return null;

          return (
            <Badge key={projectId}>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0 ml-0.5",
                    getProjectColorBgClass(project.color),
                  )}
                />
                <span className="truncate">{project.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProject(projectId);
                }}
                className="flex items-center justify-center transition-colors [&_svg]:hover:text-blue-500 [&_svg]:text-icon-light ml-0.5 outline-none"
                aria-label={`Remove ${project.name} filter`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          );
        })}
        <button
          type="button"
          onClick={onClearFilter}
          className="flex items-center justify-center transition-colors [&_svg]:hover:text-blue-500 [&_svg]:text-icon-light border border-border-light rounded-sm px-1.5 pl-px py-0.5 h-[22px] gap-px group"
          aria-label="Clear filters"
        >
          <Icon
            name="XmarkCircleFillIcon"
            className="size-4.5 text-icon-light group-hover:text-blue-500"
          />
          <span className="text-xs group-hover:text-blue-500 text-text-muted">
            {" "}
            Clear{" "}
          </span>
        </button>
      </div>
      <div className="h-px bg-border-light w-full" />
    </>
  );
}
