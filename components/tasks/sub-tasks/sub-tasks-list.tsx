"use client";

import type React from "react";
import { memo, useRef, useState } from "react";
import {
  type Control,
  Controller,
  type FieldArrayPath,
  type FieldPath,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import { RingPercentage } from "@/app/insights/_components/ring-percentage";
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

/**
 * Root container for subtasks list.
 * Provides hover states and layout structure.
 */
function SubTasksListRoot({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='subtasks-list'
      className={cn(
        "group hover:bg-hover/30 flex flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * Header component displaying subtask progress.
 * Shows ring percentage and completion count.
 */
function SubTasksListHeader({
  completed,
  total,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  completed: number;
  total: number;
}) {
  const hasSubTasks = total > 0;
  const completionPercentage = hasSubTasks
    ? Math.round((completed / total) * 100)
    : 0;

  return (
    <div
      data-slot='subtasks-list-header'
      className={cn(
        "text-xs text-text-muted px-2 mb-2 pt-1.5 flex items-center gap-1.5",
        className
      )}
      {...props}
    >
      {hasSubTasks ? (
        <div className='flex items-center justify-center pt-[1px] pl-0.5'>
          <RingPercentage
            value={completionPercentage}
            size={12}
            strokeWidth={2}
            ariaLabel='Sub-task completion'
            showLabel={false}
          />
        </div>
      ) : (
        <Icon name='ChecklistIcon' className='size-3.5' />
      )}
      {hasSubTasks ? (
        <span className='text-xs text-text-muted'>
          {completed} / {total} Completed
        </span>
      ) : (
        <span className='text-xs text-text-muted'>Sub-tasks</span>
      )}
    </div>
  );
}

/**
 * Individual subtask item container.
 * Provides row layout and hover states.
 */
function SubTasksListItem({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot='subtasks-list-item'
      className={cn(
        "relative flex items-center gap-2 group/subtask hover:bg-hover pl-2 pr-1",
        className
      )}
      {...props}
    />
  );
}

/**
 * Add new subtask input row.
 * Includes input field and submit button.
 */
function SubTasksListAddItem({
  value,
  onChange,
  onSubmit,
  placeholder = "Add a sub-task...",
  disabled,
  className,
  inputRef,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      data-slot='subtasks-list-add-item'
      className={cn(
        "flex gap-2 pl-2.5 pr-0 items-center hover:bg-hover",
        className
      )}
      {...props}
    >
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        className='flex-1 border-none p-0 h-8 hover:bg-transparent'
      />
      <Button
        type='button'
        variant='icon'
        size='sm'
        onClick={onSubmit}
        disabled={disabled ?? !value.trim()}
        className='text-[13px] font-regular h-8 rounded-l-none hover:text-blue-500 text-text-muted p-0'
      >
        <Icon name='PlusCircleFillIcon' className='size-[22px]' />
      </Button>
    </div>
  );
}

interface SubTasksListFormProps {
  control: Control<TicketFormInput>;
  name?: FieldArrayPath<TicketFormInput>;
}

interface SubTasksListControlledProps {
  subTasks: SubTask[];
  onToggle: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  onAdd?: (text: string) => void;
  readOnly?: boolean;
}

type SubTasksListProps =
  | ({ variant?: "form" } & SubTasksListFormProps)
  | ({ variant?: "controlled" } & SubTasksListControlledProps);

export function SubTasksList(props: SubTasksListProps) {
  if ("control" in props) {
    return <SubTasksListForm {...props} />;
  }

  return <SubTasksListControlled {...props} />;
}

function SubTasksListForm({ control, name }: SubTasksListFormProps) {
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
    <SubTasksListRoot>
      <SubTasksListHeader completed={completedCount} total={totalCount} />
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
      <SubTasksListAddItem
        inputRef={inputRef}
        value={newTaskText}
        onChange={setNewTaskText}
        onSubmit={addSubTask}
      />
    </SubTasksListRoot>
  );
}

function SubTasksListControlled({
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
    <SubTasksListRoot>
      <SubTasksListHeader completed={completedCount} total={totalCount} />
      <div className='flex flex-col w-full'>
        {subTasks.map((subTask) => (
          <ControlledSubTaskRow
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
    </SubTasksListRoot>
  );
}

interface ControlledSubTaskRowProps {
  subTask: SubTask;
  onToggle: () => void;
  onTextChange?: (value: string) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

const ControlledSubTaskRow = memo(function ControlledSubTaskRow({
  subTask,
  onToggle,
  onTextChange,
  onDelete,
  readOnly = false,
}: ControlledSubTaskRowProps) {
  return (
    <SubTasksListItem>
      <Checkbox
        checked={!!subTask.completed}
        onCheckedChange={() => {
          if (!readOnly) {
            onToggle();
          }
        }}
        className='border-border-medium'
        disabled={readOnly}
      />
      <Input
        value={subTask.text}
        onChange={(event) => onTextChange?.(event.target.value)}
        readOnly={readOnly || !onTextChange}
        className={cn(
          "flex-1 border-none bg-transparent p-0 focus-visible:ring-0 h-5 hover:bg-transparent",
          subTask.completed && "line-through text-text-muted",
          readOnly && "cursor-default"
        )}
      />
      {onDelete && !readOnly && (
        <>
          <span
            aria-hidden='true'
            className='pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-dialog via-dialog/90 to-transparent group-hover/subtask:from-hover group-hover/subtask:via-hover  group-hover/subtask:to-transparent z-10'
          />
          <div className='absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-end bg-gradient-to-r from-transparent via-dialog group-hover/subtask:via-hover group-hover/subtask:to-hover to-dialog pl-0 group-hover/subtask:pl-2 h-5 right-0'>
            <Button
              type='button'
              variant='icon'
              size='sm'
              onClick={onDelete}
              className='text-icon-light hover:text-icon-primary hover:bg-transparent hover:text-blue-500 opacity-0 group-hover/subtask:opacity-100'
            >
              <Icon name='XmarkIcon' className='size-3.5' />
            </Button>
          </div>
        </>
      )}
    </SubTasksListItem>
  );
});

ControlledSubTaskRow.displayName = "ControlledSubTaskRow";

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
    <SubTasksListItem>
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
                "flex-1 border-none bg-transparent p-0 focus-visible:ring-0 h-5 hover:bg-transparent",
                completed && "line-through text-text-muted"
              )}
            />
          );
        }}
      />
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-dialog via-dialog/90 to-transparent group-hover/subtask:from-hover group-hover/subtask:via-hover group-hover/subtask:to-transparent z-10'
      />
      <div className='absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-end bg-gradient-to-r from-transparent via-dialog group-hover/subtask:via-hover group-hover/subtask:to-hover to-dialog pl-0 group-hover/subtask:pl-2 h-5 right-0'>
        <Button
          type='button'
          variant='icon'
          size='sm'
          onClick={() => remove(index)}
          className='text-icon-light hover:text-icon-primary bg-gradient-to-r from-transparent via-hover to-hover h-5 hover:text-blue-500 opacity-0 group-hover/subtask:opacity-100  rounded-none'
        >
          <Icon name='XmarkIcon' className='size-3.5' />
        </Button>
      </div>
    </SubTasksListItem>
  );
});

SubTaskRow.displayName = "SubTaskRow";

export {
  SubTasksListRoot,
  SubTasksListHeader,
  SubTasksListItem,
  SubTasksListAddItem,
  SubTasksListForm,
  SubTasksListControlled,
};
