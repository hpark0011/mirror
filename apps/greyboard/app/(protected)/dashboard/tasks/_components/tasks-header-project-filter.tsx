"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProjectFilter, useProjectFilterKeyboard } from "../_hooks";
import { useProjects } from "@/features/project-select";
import { ProjectFilterTrigger } from "./project-filter-trigger";
import { ProjectFilterSearch } from "./project-filter-search";
import { ProjectFilterBadges } from "./project-filter-badges";
import { ProjectFilterList } from "./project-filter-list";

/**
 * Project filter component for the tasks header.
 *
 * Provides a popover interface for filtering tasks by project with search
 * and keyboard navigation support.
 */
export function TasksHeaderProjectFilter() {
  const { projects } = useProjects();
  const { selectedProjectIds, toggleProject, clearFilter } = useProjectFilter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const hasActiveFilters = selectedProjectIds.length > 0;

  // Filter projects based on search query
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClearFilter = () => {
    clearFilter();
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset search when closing
      setSearchQuery("");
    }
  };

  const { highlightedIndex, setHighlightedIndex, handleKeyDown } =
    useProjectFilterKeyboard({
      filteredProjects,
      searchQuery,
      toggleProject,
      onClearSearch: () => setSearchQuery(""),
      onClose: () => setOpen(false),
    });

  if (projects.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ProjectFilterTrigger
          hasActiveFilters={hasActiveFilters}
          selectedProjectIds={selectedProjectIds}
          projects={projects}
          onClearFilter={handleClearFilter}
        />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[240px] p-0">
        <div>
          <ProjectFilterSearch
            value={searchQuery}
            onChange={setSearchQuery}
            onKeyDown={handleKeyDown}
          />
          {hasActiveFilters && (
            <ProjectFilterBadges
              selectedProjectIds={selectedProjectIds}
              projects={projects}
              toggleProject={toggleProject}
              onClearFilter={handleClearFilter}
            />
          )}

          <div className="p-0.5">
            <ProjectFilterList
              projects={filteredProjects}
              selectedProjectIds={selectedProjectIds}
              highlightedIndex={highlightedIndex}
              toggleProject={toggleProject}
              setHighlightedIndex={setHighlightedIndex}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
