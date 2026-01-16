"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectColor } from "@/types/board.types";
import { PROJECT_COLORS } from "@/config/tasks.config";

interface ProjectCreateEditFormProps {
  viewMode: "create" | { mode: "edit"; projectId: string };
  projectName: string;
  selectedColor: ProjectColor;
  onProjectNameChange: (name: string) => void;
  onColorChange: (color: ProjectColor) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function ProjectCreateEditForm({
  viewMode,
  projectName,
  selectedColor,
  onProjectNameChange,
  onColorChange,
  onCancel,
  onSubmit,
}: ProjectCreateEditFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSubmit = () => {
    onSubmit();
  };

  return (
    <div className='px-2.5 pt-2 pb-1.5 flex flex-col w-full gap-3'>
      <div className='flex flex-col w-full gap-1.5'>
        <label className='text-xs font-medium text-text-muted'>
          Project Name
        </label>
        <Input
          placeholder='Enter project name...'
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className='h-8 w-[calc(100%+8px)] ml-[-4px]'
        />
      </div>

      <div className='flex flex-col w-full gap-1.5'>
        <label className='text-xs font-medium text-text-muted'>Color</label>
        <div className='flex justify-between flex-row'>
          {PROJECT_COLORS.map(({ color, bgClass }) => (
            <button
              key={color}
              type='button'
              onClick={() => onColorChange(color)}
              className={cn(
                "size-6 rounded-full transition-all border-1",
                selectedColor === color
                  ? "shadow-[0_0_0_2px_rgba(0,0,0,0.15)] dark:shadow-[0_0_0_2px_rgba(255,255,255,0.2)] scale-120"
                  : "border-transparent hover:scale-105",
                bgClass
              )}
              aria-label={`Select ${color} color`}
            />
          ))}
        </div>
      </div>

      <div className='flex gap-1 pt-2 w-[calc(100%+8px)] ml-[-4px]'>
        <Button
          size='sm'
          variant='outline'
          className='flex-1'
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size='sm'
          variant='primary'
          className='flex-1'
          onClick={handleSubmit}
          disabled={!projectName.trim()}
        >
          {viewMode === "create" ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  );
}
