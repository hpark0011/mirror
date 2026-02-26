"use client";

import { useRef, useState } from "react";
import {
  type Control,
  type FieldArrayPath,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import type { TicketFormInput } from "@/features/ticket-form";
import { SubTasksListAddItem } from "./sub-tasks-list-add-item";
import { SubTasksListHeader } from "./sub-tasks-list-header";
import { SubTasksListContainer } from "./sub-tasks-list-container";
import { SubTaskRowForm } from "@/features/sub-task";
import type { SubTask as SubTaskType } from "@feel-good/greyboard-core/types";

interface SubTasksListFormProps {
  control: Control<TicketFormInput>;
  name?: FieldArrayPath<TicketFormInput>;
}

/**
 * Form variant of subtasks list.
 * Integrates with React Hook Form for state management.
 */
export function SubTasksListForm({ control, name }: SubTasksListFormProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const fieldName = (name ?? "subTasks") as FieldArrayPath<TicketFormInput>;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName,
  });

  const subTasks =
    (useWatch({ control, name: fieldName }) as SubTaskType[] | undefined) ?? [];

  const addSubTask = () => {
    const trimmed = newTaskText.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }

    append({
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
    });
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
        {fields.map((field, index) => (
          <SubTaskRowForm
            key={field.id ?? `${fieldName}-${index}`}
            control={control}
            name={fieldName}
            index={index}
            remove={remove}
          />
        ))}
      </div>
      <SubTasksListAddItem
        inputRef={inputRef}
        value={newTaskText}
        onChange={setNewTaskText}
        onSubmit={addSubTask}
      />
    </SubTasksListContainer>
  );
}
