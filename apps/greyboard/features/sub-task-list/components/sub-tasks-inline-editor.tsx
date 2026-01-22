"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { cn } from "@/lib/utils";
import type { SubTask } from "@/types/board.types";
import { SubTasksListControlled } from "./sub-tasks-list-controlled";

interface SubTasksInlineEditorProps {
  initialSubTasks: SubTask[];
  onSave: (subTasks: SubTask[]) => void;
  debounceMs?: number;
  readOnly?: boolean;
}

export function SubTasksInlineEditor({
  initialSubTasks,
  onSave,
  debounceMs = 400,
  readOnly = false,
}: SubTasksInlineEditorProps) {
  const [draft, setDraft] = useState<SubTask[]>(initialSubTasks);
  const [isDirty, setIsDirty] = useState(false);

  const debouncedSave = useDebouncedCallback((subTasks: SubTask[]) => {
    onSave(subTasks);
    setIsDirty(false);
  }, debounceMs);

  const handleMutate = useCallback(
    (updater: (current: SubTask[]) => SubTask[]) => {
      setDraft((current) => {
        const updated = updater(current);
        setIsDirty(true);
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  const handleToggle = useCallback(
    (id: string) => {
      handleMutate((current) =>
        current.map((subTask) =>
          subTask.id === id
            ? { ...subTask, completed: !subTask.completed }
            : subTask
        )
      );
    },
    [handleMutate]
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      handleMutate((current) =>
        current.map((subTask) =>
          subTask.id === id ? { ...subTask, text } : subTask
        )
      );
    },
    [handleMutate]
  );

  const handleDelete = useCallback(
    (id: string) => {
      handleMutate((current) => current.filter((subTask) => subTask.id !== id));
    },
    [handleMutate]
  );

  const handleAdd = useCallback(
    (text: string) => {
      handleMutate((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          text,
          completed: false,
        },
      ]);
    },
    [handleMutate]
  );

  // Sync external changes only when not dirty (conditional to prevent cascading renders)
  useEffect(() => {
    if (!isDirty) {
      setDraft(initialSubTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSubTasks]);

  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  const containerClassName = useMemo(
    () =>
      cn(
        "relative border-border-light mt-0.5 rounded-b-[11px] p-0 overflow-hidden",
        readOnly ? "bg-transparent" : "bg-dialog"
      ),
    [readOnly]
  );

  return (
    <div className={containerClassName}>
      {!readOnly && isDirty ? (
        <div className='absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground'>
          <LoaderCircle
            className='h-3 w-3 animate-spin text-blue-400 '
            aria-hidden='true'
          />
        </div>
      ) : null}
      <SubTasksListControlled
        subTasks={draft}
        onToggle={handleToggle}
        onTextChange={handleTextChange}
        onDelete={readOnly ? undefined : handleDelete}
        onAdd={readOnly ? undefined : handleAdd}
        readOnly={readOnly}
      />
    </div>
  );
}
