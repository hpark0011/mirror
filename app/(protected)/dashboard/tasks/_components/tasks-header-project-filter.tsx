"use client";

import { XIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProjectFilter } from "../_hooks";
import { useProjects } from "@/features/project-select";
import { cn } from "@/lib/utils";
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

interface ClearFilterButtonProps {
  onClick: () => void;
  className?: string;
}

function ClearFilterButton({ onClick, className }: ClearFilterButtonProps) {
  return (
    <button
      type='button'
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center justify-center transition-colors cursor-pointer px-1 group h-full hover:shadow-lg",
        className
      )}
      aria-label='Clear filters'
    >
      <XIcon className='size-3.5 text-icon-light group-hover:text-blue-500' />
    </button>
  );
}

export function TasksHeaderProjectFilter() {
  const { projects } = useProjects();
  const { selectedProjectIds, toggleProject, clearFilter } = useProjectFilter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const hasActiveFilters = selectedProjectIds.length > 0;

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset highlighted index when search changes (only if currently highlighted)
  useEffect(() => {
    if (highlightedIndex !== -1) {
      setHighlightedIndex(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleClearFilter = () => {
    clearFilter();
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset search when closing
      setSearchQuery("");
      setHighlightedIndex(-1);
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredProjects.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredProjects[highlightedIndex]) {
          toggleProject(filteredProjects[highlightedIndex].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        if (searchQuery) {
          setSearchQuery("");
          setHighlightedIndex(-1);
        } else {
          setOpen(false);
        }
        break;
    }
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='icon'
          size='icon-sm'
          aria-label='Filter by project'
          className={cn(
            hasActiveFilters &&
              "bg-card shadow-xs border-border-highlight dark:border-white/2 border h-[24px] w-auto rounded-sm transition-all duration-200 ease-out scale-100 translate-y-[0px] overflow-hidden text-[13px] mx-1.5 hover:bg-card"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center size-7 relative",
              hasActiveFilters && "hover:bg-hover rounded-sm"
            )}
          >
            <Icon
              name='Line3Icon'
              className={cn(
                "size-4.5",
                hasActiveFilters ? "text-blue-400" : "text-icon-light"
              )}
            />
          </div>

          {hasActiveFilters && (
            <>
              <div className='w-px self-stretch mx-0 bg-border-light' />
              <div className='h-full'>
                {selectedProjectIds.length === 1 ? (
                  <div className='flex items-center relative h-full'>
                    <div className='px-1.5 flex items-center gap-1.5'>
                      <span
                        className={cn(
                          "size-1.5 rounded-full flex-shrink-0",
                          PROJECT_COLOR_CLASSES[
                            projects.find((p) => p.id === selectedProjectIds[0])
                              ?.color || "gray"
                          ]
                        )}
                      />
                      {projects.find((p) => p.id === selectedProjectIds[0])
                        ?.name || "Filter"}
                    </div>
                    <div className='w-px self-stretch mx-0 bg-border-light' />
                    <ClearFilterButton
                      onClick={handleClearFilter}
                      className='hover:bg-base'
                    />
                  </div>
                ) : (
                  <div className='flex items-center relative h-full pl-1.5'>
                    <Icon
                      name='FolderFillIcon'
                      className='size-4 text-icon-light'
                    />
                    <div className='pr-1.5 pl-1 text-text-primary'>
                      {selectedProjectIds.length} projects
                    </div>
                    <div className='w-px self-stretch mx-0 bg-border-light' />
                    <ClearFilterButton
                      onClick={handleClearFilter}
                      className='hover:bg-hover'
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align='end' className='w-[240px] p-0'>
        <div>
          <Input
            placeholder='Filter by projects...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className='h-8 border-none'
            autoFocus={false}
          />
          <div className='h-[1px] bg-border-light w-full' />
          {hasActiveFilters && (
            <>
              <div className='flex items-center gap-1 p-1 flex-wrap'>
                {selectedProjectIds.map((projectId) => {
                  const project = projects.find((p) => p.id === projectId);
                  if (!project) return null;

                  return (
                    <Badge key={projectId}>
                      <div className='flex items-center gap-1.5'>
                        <span
                          className={cn(
                            "size-1.5 rounded-full flex-shrink-0 ml-0.5",
                            PROJECT_COLOR_CLASSES[project.color]
                          )}
                        />
                        <span className='truncate'>{project.name}</span>
                      </div>
                      <button
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProject(projectId);
                        }}
                        className='flex items-center justify-center transition-colors [&_svg]:hover:text-blue-500 [&_svg]:text-icon-light ml-0.5 outline-none'
                        aria-label={`Remove ${project.name} filter`}
                      >
                        <XIcon className='size-3' />
                      </button>
                    </Badge>
                  );
                })}
                <button
                  type='button'
                  onClick={handleClearFilter}
                  className='flex items-center justify-center transition-colors [&_svg]:hover:text-blue-500 [&_svg]:text-icon-light border border-border-light rounded-sm px-1.5 pl-[1px] py-0.5 h-[22px] gap-[1px] group'
                  aria-label='Clear filters'
                >
                  <Icon
                    name='XmarkCircleFillIcon'
                    className='size-4.5 text-icon-light group-hover:text-blue-500'
                  />
                  <span className='text-xs group-hover:text-blue-500 text-text-muted'>
                    {" "}
                    Clear{" "}
                  </span>
                </button>
              </div>
              <div className='h-[1px] bg-border-light w-full' />
            </>
          )}

          <div className='p-0.5'>
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project: Project, index) => {
                const isSelected = selectedProjectIds.includes(project.id);
                return (
                  <button
                    type='button'
                    key={project.id}
                    className={cn(
                      "flex items-center space-x-2 rounded-md px-2 pl-1 py-1.5 hover:bg-accent cursor-pointer h-6 w-full",
                      highlightedIndex === index &&
                        "bg-accent text-accent-foreground"
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
                          PROJECT_COLOR_CLASSES[project.color]
                        )}
                      />
                      <span className='flex-1 text-start'>{project.name}</span>
                    </label>
                  </button>
                );
              })
            ) : (
              <div className='px-1 py-6 text-center text-xs text-muted-foreground'>
                No projects found
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
