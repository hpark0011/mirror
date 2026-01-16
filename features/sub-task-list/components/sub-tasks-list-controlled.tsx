"use client";

import { useRef, useState } from "react";
import { SubTaskRowControlled } from "@/features/sub-task";
import { SubTasksListAddItem } from "./sub-tasks-list-add-item";
import { SubTasksListHeader } from "./sub-tasks-list-header";
import { SubTasksListContainer } from "./sub-tasks-list-container";
import type { SubTask } from "@/types/board.types";

interface SubTasksListControlledProps {
  subTasks: SubTask[];
  onToggle: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: (text: string) => void;
  readOnly?: boolean;
}

/**
 * Controlled variant of subtasks list.
 * State is managed externally via props.
 */
export function SubTasksListControlled({
  subTasks,
  onToggle,
  onTextChange,
  onDelete,
  onAdd,
  readOnly = false,
}: SubTasksListControlledProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleAdd = () => {
    if (!onAdd) return;
    const trimmed = newTaskText.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }

    onAdd(trimmed);
    setNewTaskText("");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const completedCount = subTasks.filter((task) => task?.completed).length;
  const totalCount = subTasks.length;

  return (
    <SubTasksListContainer>
      <SubTasksListHeader completed={completedCount} total={totalCount} />
      <div className='flex flex-col w-full'>
        {subTasks.map((subTask) => (
          <SubTaskRowControlled
            key={subTask.id}
            subTask={subTask}
            onToggle={() => onToggle(subTask.id)}
            onTextChange={
              onTextChange
                ? (value) => onTextChange(subTask.id, value)
                : undefined
            }
            onDelete={onDelete ? () => onDelete(subTask.id) : undefined}
            readOnly={readOnly}
          />
        ))}
      </div>
      {!readOnly && onAdd && (
        <SubTasksListAddItem
          inputRef={inputRef}
          value={newTaskText}
          onChange={setNewTaskText}
          onSubmit={handleAdd}
        />
      )}
    </SubTasksListContainer>
  );
}
