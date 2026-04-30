"use client";

import { useCallback, useState } from "react";
import { showToast } from "@feel-good/ui/components/toast";
import { useBioEntries } from "./use-bio-entries";
import { type BioEntry } from "../types";
import { type BioEntryFormValues } from "../lib/schemas/bio-entry.schema";
import {
  getMutationErrorMessage,
  toMutationArgs,
} from "../utils/mutation-helpers";

export type BioDialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; entry: BioEntry };

/**
 * Drives `<BioPanel>`'s dialog + mutation flow. Surfaces create/update errors
 * via `formError` (rendered into the dialog's `errorSlot`) and delete errors
 * via toast — never via unhandled promise rejections.
 */
export function useBioPanelHandlers() {
  const { entries, createEntry, updateEntry, removeEntry } = useBioEntries();
  const [dialog, setDialog] = useState<BioDialogState>({ open: false });
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setFormError(null);
    setDialog({ open: true, mode: "create" });
  }, []);
  const openEdit = useCallback((entry: BioEntry) => {
    setFormError(null);
    setDialog({ open: true, mode: "edit", entry });
  }, []);
  const closeDialog = useCallback(() => {
    setFormError(null);
    setDialog({ open: false });
  }, []);

  const handleDelete = useCallback(
    async (entry: BioEntry) => {
      try {
        await removeEntry({ id: entry._id });
      } catch (err) {
        showToast({ type: "error", title: getMutationErrorMessage(err) });
      }
    },
    [removeEntry],
  );

  const handleSubmit = useCallback(
    async (values: BioEntryFormValues) => {
      const args = toMutationArgs(values);
      try {
        if (dialog.open && dialog.mode === "edit") {
          await updateEntry({ id: dialog.entry._id, ...args });
        } else {
          await createEntry(args);
        }
        setFormError(null);
        setDialog({ open: false });
      } catch (err) {
        // Keep dialog open so the user can adjust and retry.
        setFormError(getMutationErrorMessage(err));
      }
    },
    [createEntry, updateEntry, dialog],
  );

  return {
    entries,
    dialog,
    formError,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
  };
}
