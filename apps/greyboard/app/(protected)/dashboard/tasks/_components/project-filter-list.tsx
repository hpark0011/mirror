"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getProjectColorBgClass } from "@/config/tasks.config";
import type { Project } from "@/types/board.types";

interface ProjectFilterListProps {
  projects: Project[];
  selectedProjectIds: string[];
  highlightedIndex: number;
  toggleProject: (projectId: string) => void;
  setHighlightedIndex: (index: number) => void;
}

/**
 * Scrollable list of projects in the filter dropdown.
 *
 * Displays projects with checkboxes, handles selection, and shows highlighted state
 * for keyboard navigation. Shows empty state when no projects match the filter.
 *
 * @param projects - Filtered list of projects to display
 * @param selectedProjectIds - Array of currently selected project IDs
 * @param highlightedIndex - Index of the currently highlighted project (-1 if none)
 * @param toggleProject - Handler to toggle project selection
 * @param setHighlightedIndex - Handler to update highlighted index
 */
export function ProjectFilterList({
  projects,
  selectedProjectIds,
  highlightedIndex,
  toggleProject,
  setHighlightedIndex,
}: ProjectFilterListProps) {
  if (projects.length === 0) {
    return (
      <div className='px-1 py-6 text-center text-xs text-muted-foreground'>
        No projects found
      </div>
    );
  }

  return (
    <>
      {projects.map((project, index) => {
        const isSelected = selectedProjectIds.includes(project.id);
        return (
          <button
            type='button'
            key={project.id}
            className={cn(
              "flex items-center space-x-2 rounded-md px-2 pl-1 py-1.5 hover:bg-accent cursor-pointer h-6 w-full",
              highlightedIndex === index && "bg-accent text-accent-foreground"
            )}
            onClick={() => toggleProject(project.id)}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            <div
              aria-hidden
              className={cn(
                "w-4 h-4 shrink-0 rounded-full border transition-colors flex items-center justify-center",
                isSelected
                  ? "bg-blue-500 border-blue-500 text-primary-foreground"
                  : ""
              )}
            >
              {isSelected ? (
                <Icon
                  name='CheckmarkSmallIcon'
                  className='min-w-4 size-4 text-white'
                />
              ) : null}
            </div>
            <label
              htmlFor={`project-${project.id}`}
              className='flex items-center gap-1.5 flex-1 text-sm cursor-pointer'
            >
              <div
                className={cn(
                  "size-1.5 rounded-full",
                  getProjectColorBgClass(project.color)
                )}
              />
              <span className='flex-1 text-start'>{project.name}</span>
            </label>
          </button>
        );
      })}
    </>
  );
}
