"use client";

import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SubTaskDeleteButton } from "./sub-task-delete-button";
import { SubTaskFadeOverlay } from "./sub-task-fade-overlay";
import { SubTaskRowWrapper } from "./sub-task-row-wrapper";

interface SubTaskRowProps {
  /** Current text value */
  text: string;
  /** Current completion state */
  completed: boolean;
  /** Called when completion checkbox changes */
  onCompletedChange: (completed: boolean) => void;
  /** Called when text input changes */
  onTextChange: (text: string) => void;
  /** Called when delete button clicked. If undefined, delete button is hidden. */
  onDelete?: () => void;
  /** Disables all interactions */
  disabled?: boolean;
}

/**
 * Pure presentational row for a single sub-task.
 *
 * Renders: Checkbox + Text Input + (optional) Delete Button
 *
 * This component owns NO state - all values and handlers come from props.
 * Use SubTaskRowForm for React Hook Form integration, or
 * SubTaskRowControlled for external state management.
 */
export const SubTaskRow = memo(function SubTaskRow({
  text,
  completed,
  onCompletedChange,
  onTextChange,
  onDelete,
  disabled = false,
}: SubTaskRowProps) {
  return (
    <SubTaskRowWrapper>
      <Checkbox
        checked={completed}
        onCheckedChange={(checked) => onCompletedChange(!!checked)}
        disabled={disabled}
        className='border-border-medium'
      />
      <Input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        readOnly={disabled}
        className={cn(
          "flex-1 border-none bg-transparent p-0 focus-visible:ring-0 h-5 hover:bg-transparent text-[13px]",
          completed && "line-through text-text-muted",
          disabled && "cursor-default"
        )}
      />
      {onDelete && !disabled && (
        <SubTaskFadeOverlay>
          <SubTaskDeleteButton onDelete={onDelete} />
        </SubTaskFadeOverlay>
      )}
    </SubTaskRowWrapper>
  );
});

SubTaskRow.displayName = "SubTaskRow";
