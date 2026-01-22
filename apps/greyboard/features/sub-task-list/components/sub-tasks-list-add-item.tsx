"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SubTasksListAddItemProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Add new subtask input row.
 * Includes input field and submit button.
 */
export function SubTasksListAddItem({
  value,
  onChange,
  onSubmit,
  placeholder = "Add a sub-task...",
  disabled,
  className,
  inputRef,
  ...props
}: SubTasksListAddItemProps) {
  return (
    <div
      data-slot="subtasks-list-add-item"
      className={cn(
        "flex gap-2 pl-2.5 pr-0 items-center hover:bg-hover",
        className,
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
        className="flex-1 border-none p-0 h-8 hover:bg-transparent text-[13px]"
      />
      <Button
        type="button"
        variant="icon"
        size="sm"
        onClick={onSubmit}
        disabled={disabled ?? !value.trim()}
        className="text-[13px] font-regular h-8 rounded-l-none hover:text-blue-500 text-text-muted p-0"
      >
        <Icon name="PlusCircleFillIcon" className="size-[22px]" />
      </Button>
    </div>
  );
}
