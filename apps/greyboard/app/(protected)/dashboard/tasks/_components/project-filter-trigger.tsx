"use client";

import { type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { getProjectColorBgClass } from "@/config/tasks.config";
import { ProjectFilterClearButton } from "./project-filter-clear-button";
import { ProjectFilterDivider } from "./project-filter-divider";
import type { Project } from "@/types/board.types";

interface ProjectFilterTriggerProps extends ComponentProps<typeof Button> {
  hasActiveFilters: boolean;
  selectedProjectIds: string[];
  projects: Project[];
  onClearFilter: () => void;
}

/**
 * Trigger button for the project filter popover.
 *
 * Displays filter icon and shows active filter state (single project name or count).
 * Extends Button props to support Radix UI's asChild pattern for PopoverTrigger.
 *
 * @param hasActiveFilters - Whether any filters are currently active
 * @param selectedProjectIds - Array of selected project IDs
 * @param projects - All available projects
 * @param onClearFilter - Handler to clear all filters
 * @param props - Additional button props forwarded from PopoverTrigger
 */
export function ProjectFilterTrigger({
  hasActiveFilters,
  selectedProjectIds,
  projects,
  onClearFilter,
  ...props
}: ProjectFilterTriggerProps) {
  // Find selected project for single project display
  const selectedProject = selectedProjectIds.length === 1
    ? projects.find((p) => p.id === selectedProjectIds[0])
    : null;

  return (
    <Button
      variant="icon"
      size="icon-sm"
      aria-label="Filter by project"
      className={cn(
        hasActiveFilters &&
          "bg-card shadow-xs border-border-highlight dark:border-white/2 border h-[24px] w-auto rounded-sm transition-all duration-200 ease-out scale-100 translate-y-[0px] overflow-hidden text-[13px] mx-1.5 hover:bg-card gap-0",
      )}
      {...props}
    >
      {/* Filter icon button */}
      <div
        className={cn(
          "flex items-center justify-center size-7 relative",
          hasActiveFilters && "hover:bg-hover rounded-sm",
        )}
      >
        <Icon
          name="Line3Icon"
          className={cn(
            "size-4.5",
            hasActiveFilters ? "text-blue-400" : "text-icon-light",
          )}
        />
      </div>

      {hasActiveFilters && (
        <>
          {/* Divider */}
          <ProjectFilterDivider />

          {/* Filter indicator */}
          {selectedProjectIds.length === 1
            ? (
              <div className="flex items-center relative h-full px-1 pl-0.5">
                <div className="px-1.5 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 rounded-full flex-shrink-0",
                      getProjectColorBgClass(selectedProject?.color || "gray"),
                    )}
                  />
                  {selectedProject?.name || "Filter"}
                </div>
              </div>
            )
            : (
              <div className="flex items-center relative h-full pl-1.5 pr-0.5">
                <Icon
                  name="FolderFillIcon"
                  className="size-4 text-icon-light"
                />
                <div className="pr-1.5 pl-1 text-text-primary">
                  {selectedProjectIds.length} projects
                </div>
              </div>
            )}

          {/* Divider */}
          <ProjectFilterDivider />

          {/* Clear button */}
          <ProjectFilterClearButton
            onClick={onClearFilter}
            className={selectedProjectIds.length === 1
              ? "hover:bg-base"
              : "hover:bg-hover"}
          />
        </>
      )}
    </Button>
  );
}
