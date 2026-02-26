"use client";

import { memo } from "react";
import type { SubTask as SubTaskType } from "@feel-good/greyboard-core/types";
import { SubTaskRow } from "./sub-task-row";

interface SubTaskRowControlledProps {
  subTask: SubTaskType;
  onToggle: () => void;
  onTextChange?: (value: string) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

/**
 * Controlled adapter for SubTaskRow.
 * Maps external state management props to SubTaskRow's unified API.
 */
export const SubTaskRowControlled = memo(function SubTaskRowControlled({
  subTask,
  onToggle,
  onTextChange,
  onDelete,
  readOnly = false,
}: SubTaskRowControlledProps) {
  return (
    <SubTaskRow
      text={subTask.text}
      completed={!!subTask.completed}
      onCompletedChange={() => onToggle()}
      onTextChange={onTextChange ?? (() => {})}
      onDelete={onDelete}
      disabled={readOnly}
    />
  );
});

SubTaskRowControlled.displayName = "SubTaskRowControlled";
