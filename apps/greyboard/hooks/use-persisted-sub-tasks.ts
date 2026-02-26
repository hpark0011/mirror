"use client";

import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { TicketFormInput } from "@/features/ticket-form";
import type { SubTask } from "@/features/sub-task-list/components/sub-tasks-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getStorageKey } from "@/lib/storage-keys";

const TICKET_FORM_SUBTASKS_STORAGE_KEY = getStorageKey(
  "TASKS",
  "TICKET_FORM_SUBTASKS"
);

/**
 * Manages persistent draft sub-tasks for CREATE mode only
 *
 * This hook maintains a global draft of sub-tasks that persists across sessions
 * for creating new tickets. In edit mode, it does nothing (tickets use their own data).
 *
 * Behavior by mode:
 * - **Create mode**: Loads draft when dialog opens, saves changes to draft
 * - **Edit mode**: No-op (ticket sub-tasks come from defaultValues)
 *
 * The draft never auto-clears; it persists indefinitely until manually cleared.
 *
 * @param form - React Hook Form instance for the ticket form
 * @param open - Dialog open state, used to trigger loading persisted data
 * @param mode - Form mode: "create" for new tickets, "edit" for existing tickets
 * @returns Object containing clearSubTasks function for manual clearing (create mode only)
 *
 * @example
 * const { clearSubTasks } = usePersistedSubTasks(form, open, "create");
 *
 * // Manually clear draft when user clicks a "clear draft" button
 * <Button onClick={clearSubTasks}>Clear Draft</Button>
 */
export function usePersistedSubTasks(
  form: UseFormReturn<TicketFormInput>,
  open: boolean,
  mode: "create" | "edit"
) {
  const [storedSubTasks, setStoredSubTasks, clearStoredSubTasks] =
    useLocalStorage<SubTask[]>(TICKET_FORM_SUBTASKS_STORAGE_KEY, []);

  // Load persisted draft into form when dialog opens (CREATE MODE ONLY)
  useEffect(() => {
    if (mode !== "create" || !open) {
      return;
    }

    if ((storedSubTasks?.length ?? 0) === 0) {
      return;
    }

    const currentSubTasks = form.getValues("subTasks") ?? [];
    // Only populate if form is empty
    if (currentSubTasks.length === 0) {
      form.setValue("subTasks", storedSubTasks ?? []);
    }
  }, [form, storedSubTasks, open, mode]);

  // Watch form changes and save to draft (CREATE MODE ONLY)
  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    const subscription = form.watch((values, { name }) => {
      // Only react to sub-tasks field changes
      if (name && name !== "subTasks" && !name.startsWith("subTasks")) {
        return;
      }

      // Filter and validate sub-tasks before storing
      const subTasks = (values?.subTasks ?? []).filter(
        (task): task is SubTask =>
          !!task &&
          typeof task.id === "string" &&
          typeof task.text === "string" &&
          typeof task.completed === "boolean"
      );
      setStoredSubTasks(subTasks);
    });

    return () => subscription.unsubscribe();
  }, [form, setStoredSubTasks, mode]);

  return {
    clearSubTasks: clearStoredSubTasks,
    storedSubTasks,
  };
}
