"use client";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/board.types";
import { CheckIcon } from "lucide-react";
import { memo, useState, type MouseEvent } from "react";
import { ProjectColorIndicator } from "./project-color-indicator";

interface ProjectMenuItemProps {
  project: Project;
  isSelected: boolean;
  isKeyboardHighlighted: boolean;
  onSelect: (projectId: string) => void;
  onEdit: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

/**
 * Individual project menu item with optimized hover performance.
 *
 * Uses local state for hover to prevent parent re-renders. Combines
 * keyboard highlighting (from parent) with local hover state for visual feedback.
 *
 * Memoized to prevent unnecessary re-renders when other items change.
 */
export const ProjectMenuItem = memo(function ProjectMenuItem({
  project,
  isSelected,
  isKeyboardHighlighted,
  onSelect,
  onEdit,
  onDelete,
}: ProjectMenuItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Combine keyboard and hover highlighting
  const isHighlighted = isKeyboardHighlighted || isHovered;

  const handleEdit = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEdit(project.id);
  };

  const handleDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete(project.id);
  };

  const handleSelect = (e: Event) => {
    e.preventDefault();
    onSelect(project.id);
  };

  return (
    <DropdownMenuItem
      className={cn(
        "group flex items-center justify-between gap-2 pl-1 pr-0.5 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        isHighlighted && "bg-accent text-accent-foreground"
      )}
      onSelect={handleSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className='flex flex-1 min-w-0 items-center px-1'>
        <ProjectColorIndicator
          color={project.color}
          name={project.name}
          className='flex-1 min-w-0'
        />
      </div>
      <div className='flex items-center gap-0.5'>
        <div
          className={cn(
            "flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-data-[highlighted]:opacity-100",
            isHighlighted && "opacity-100"
          )}
        >
          <Button
            size='sm'
            variant='icon'
            className='h-6 w-6 p-0 dark:hover:bg-black/50 [&_svg]:dark:text-dq-gray-600 [&_svg]:text-icon-light hover:[&_svg]:text-blue-500'
            onClick={handleEdit}
            aria-label='Edit project'
          >
            <Icon name='PencilIcon' className='size-4 text-icon-light' />
          </Button>
          <Button
            size='sm'
            variant='icon'
            className='h-6 w-6 p-0 dark:hover:bg-black/50 [&_svg]:dark:text-dq-gray-600 [&_svg]:text-icon-light hover:[&_svg]:text-destructive'
            onClick={handleDelete}
            aria-label='Delete project'
          >
            <Icon name='TrashFillIcon' className='size-4 text-icon-light' />
          </Button>
        </div>
        {isSelected && (
          <CheckIcon className='size-4 text-blue-400 mr-1 ml-0.5' />
        )}
      </div>
    </DropdownMenuItem>
  );
});
