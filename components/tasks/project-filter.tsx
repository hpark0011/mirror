"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const hasActiveFilters = selectedProjectIds.length > 0;

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset highlighted index when search changes
  useEffect(() => {
    setHighlightedIndex(-1);
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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredProjects.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredProjects[highlightedIndex]) {
        // Toggle highlighted project
        toggleProject(filteredProjects[highlightedIndex].id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (searchQuery) {
        setSearchQuery("");
        setHighlightedIndex(-1);
      } else {
        setOpen(false);
      }
    }
  };

  if (projects.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          className={cn(
            "h-6 w-fit bg-transparent cursor-pointer relative",
            hasActiveFilters && "text-blue-600 dark:text-blue-400"
          )}
          size='sm'
        >
          <Icon
            name='Line3Icon'
            className={cn(
              "size-5.5",
              hasActiveFilters
                ? "text-blue-600 dark:text-blue-400"
                : "text-icon-light"
            )}
          />
          {hasActiveFilters ? (
            <div className='absolute -top-0.5 -right-0.5 size-2 bg-blue-600 dark:bg-blue-400 rounded-full' />
          ) : (
            "Filter"
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align='end' className='w-[240px] p-0'>
        <div>
          <div className='flex items-center justify-between'>
            {hasActiveFilters && (
              <Button
                variant='ghost'
                size='sm'
                onClick={handleClearFilter}
                className='h-6 px-2 text-xs text-muted-foreground hover:text-foreground'
              >
                Clear
              </Button>
            )}
          </div>

          <Input
            placeholder='Filter by projects...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className='h-8 border-none'
            autoFocus={false}
          />

          <div className='space-y-2'>
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project: Project, index) => {
                const isSelected = selectedProjectIds.includes(project.id);
                return (
                  <div
                    key={project.id}
                    className={cn(
                      "flex items-center space-x-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer",
                      highlightedIndex === index &&
                        "bg-accent text-accent-foreground"
                    )}
                    onClick={() => toggleProject(project.id)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <Checkbox
                      id={`project-${project.id}`}
                      checked={isSelected}
                      onCheckedChange={() => toggleProject(project.id)}
                      className='pointer-events-none'
                    />
                    <label
                      htmlFor={`project-${project.id}`}
                      className='flex items-center gap-2 flex-1 text-sm cursor-pointer'
                    >
                      <div
                        className={cn(
                          "size-2 rounded-full",
                          PROJECT_COLOR_CLASSES[project.color]
                        )}
                      />
                      <span className='flex-1'>{project.name}</span>
                    </label>
                  </div>
                );
              })
            ) : (
              <div className='px-2 py-6 text-center text-sm text-muted-foreground'>
                No projects found
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
