"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/use-projects";
import { useProjectFilter } from "@/hooks/use-project-filter";
import type { Project } from "@/types/board.types";

const PROJECT_COLOR_CLASSES: Record<string, string> = {
  gray: "bg-neutral-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function ProjectFilter() {
  const { projects } = useProjects();
  const { selectedProjectIds, toggleProject, clearFilter } = useProjectFilter();
  const [open, setOpen] = useState(false);

  const hasActiveFilters = selectedProjectIds.length > 0;

  const handleClearFilter = () => {
    clearFilter();
    setOpen(false);
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-6 w-6 bg-transparent cursor-pointer relative",
                hasActiveFilters && "text-blue-600 dark:text-blue-400"
              )}
            >
              <Icon
                name="Line3HorizontalIcon"
                className={cn(
                  "size-5",
                  hasActiveFilters ? "text-blue-600 dark:text-blue-400" : "text-icon-light"
                )}
              />
              {hasActiveFilters && (
                <div className="absolute -top-0.5 -right-0.5 size-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Filter by Project
          {hasActiveFilters && ` (${selectedProjectIds.length} active)`}
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-[240px] p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Filter by Project</h4>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilter}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {projects.map((project: Project) => {
              const isSelected = selectedProjectIds.includes(project.id);
              return (
                <div
                  key={project.id}
                  className="flex items-center space-x-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer"
                  onClick={() => toggleProject(project.id)}
                >
                  <Checkbox
                    id={`project-${project.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleProject(project.id)}
                    className="pointer-events-none"
                  />
                  <label
                    htmlFor={`project-${project.id}`}
                    className="flex items-center gap-2 flex-1 text-sm cursor-pointer"
                  >
                    <div
                      className={cn(
                        "size-2 rounded-full",
                        PROJECT_COLOR_CLASSES[project.color]
                      )}
                    />
                    <span className="flex-1">{project.name}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
