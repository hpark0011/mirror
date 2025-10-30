"use client";

import { memo, useRef, useState } from "react";
import {
  type Control,
  Controller,
  type FieldArrayPath,
  type FieldPath,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type { TicketFormInput } from "@/hooks/use-ticket-form";
import { cn } from "@/lib/utils";

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

interface SubTasksListProps {
  control: Control<TicketFormInput>;
  name?: FieldArrayPath<TicketFormInput>;
}

export function SubTasksList({ control, name }: SubTasksListProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const fieldName = (name ?? "subTasks") as FieldArrayPath<TicketFormInput>;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName,
  });

  const subTasks =
    (useWatch({ control, name: fieldName }) as SubTask[] | undefined) ?? [];

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
    <div className='w-[calc(100%+12px)] ml-[-6px] border border-border-medium rounded-lg group hover:bg-hover/30 flex flex-col overflow-hidden'>
      {/* Progress indicator */}
      <div className='text-xs text-text-muted px-2 mb-2 pt-1.5 flex items-center gap-1'>
        <Icon name='ChecklistIcon' className='size-3.5' />
        {/* <span className='font-medium ml-1'>Sub-tasks</span> */}
        {totalCount > 0 ? (
          <span className='text-xs text-text-muted'>
            {completedCount} / {totalCount} Completed
          </span>
        ) : (
          <span className='text-xs text-text-muted'>Sub-tasks</span>
        )}
      </div>

      {/* Sub-tasks list */}
      <div className='flex flex-col w-full'>
        {fields.map((field, index) => (
          <SubTaskRow
            key={field.id ?? `${fieldName}-${index}`}
            control={control}
            name={fieldName}
            index={index}
            remove={remove}
          />
        ))}
      </div>

      {/* Add new sub-task */}
      <div className='flex gap-2 pl-2.5 pr-0 items-center hover:bg-hover'>
        <Input
          ref={inputRef}
          placeholder='Add a sub-task...'
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSubTask();
            }
          }}
          className='flex-1 border-none p-0 h-8 hover:bg-transparent'
        />
        <Button
          type='button'
          variant='icon'
          size='sm'
          onClick={addSubTask}
          disabled={!newTaskText.trim()}
          className='text-[13px] font-regular h-8 rounded-l-none hover:text-blue-500 text-text-muted p-0'
        >
          <Icon name='PlusCircleFillIcon' className='size-[22px]' />
          {/* Add */}
        </Button>
      </div>
    </div>
  );
}

interface SubTaskRowProps {
  control: Control<TicketFormInput>;
  name: FieldArrayPath<TicketFormInput>;
  index: number;
  remove: (index?: number | number[]) => void;
}

const SubTaskRow = memo(function SubTaskRow({
  control,
  name,
  index,
  remove,
}: SubTaskRowProps) {
  const textFieldName = `${name}.${index}.text` as FieldPath<TicketFormInput>;
  const completedFieldName =
    `${name}.${index}.completed` as FieldPath<TicketFormInput>;

  const completed = useWatch<TicketFormInput>({
    control,
    name: completedFieldName,
  }) as boolean | undefined;

  return (
    <div className='flex items-center gap-2 group/subtask hover:bg-hover px-1 pl-2.5'>
      <Controller
        name={completedFieldName}
        control={control}
        render={({ field }) => (
          <Checkbox
            checked={!!field.value}
            onCheckedChange={(checked) => field.onChange(!!checked)}
            className='border-border-medium'
          />
        )}
      />
      <Controller
        name={textFieldName}
        control={control}
        render={({ field }) => {
          const { value, onChange, ...rest } = field;
          const stringValue = typeof value === "string" ? value : "";

          return (
            <Input
              {...rest}
              value={stringValue}
              onChange={(e) => onChange(e.target.value)}
              className={cn(
                "flex-1 border-none bg-transparent p-0 focus-visible:ring-0 h-6 hover:bg-transparent",
                completed && "line-through text-text-muted"
              )}
            />
          );
        }}
      />
      <Button
        type='button'
        variant='icon'
        size='sm'
        onClick={() => remove(index)}
        className='text-icon-light hover:text-icon-primary h-6 w-6 hover:bg-transparent hover:text-blue-500 opacity-0 group-hover/subtask:opacity-100 transition-opacity duration-150'
      >
        <Icon name='XmarkIcon' className='size-3.5' />
      </Button>
    </div>
  );
});

SubTaskRow.displayName = "SubTaskRow";
