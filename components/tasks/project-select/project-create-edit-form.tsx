"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProjectColor } from "@/types/board.types";
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
    <div className='p-2 '>
      <div className='flex flex-col w-full'>
        <label className='text-xs font-medium text-foreground'>
          Project Name
        </label>
        <Input
          placeholder='Enter project name...'
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className='h-8 w-[calc(100%+12px)] ml-[-6px]'
        />
      </div>

      <div className='space-y-2'>
        <label className='text-xs font-medium text-foreground'>Color</label>
        <div className='flex gap-2 flex-wrap'>
          {PROJECT_COLORS.map(({ color, bgClass }) => (
            <button
              key={color}
              type='button'
              onClick={() => onColorChange(color)}
              className={cn(
                "size-6 rounded-full transition-all border-2",
                selectedColor === color
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105",
                bgClass
              )}
              aria-label={`Select ${color} color`}
            />
          ))}
        </div>
      </div>

      <div className='flex gap-2 pt-2'>
        <Button
          size='sm'
          variant='outline'
          className='flex-1 h-8'
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size='sm'
          variant='primary'
          className='flex-1 h-8'
          onClick={handleSubmit}
          disabled={!projectName.trim()}
        >
          {viewMode === "create" ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  );
}
