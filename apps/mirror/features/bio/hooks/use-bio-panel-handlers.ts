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
 * Drives `<BioPanel>`'s dialog + mutation flow. The dialog closes
 * synchronously on submit — the list updates optimistically via
 * `useBioEntries`'s `withOptimisticUpdate` wrappers, and any server
 * rejection rolls the patch back and surfaces via toast. Client-side
 * Zod validation in the form blocks invalid submits before the dialog
 * closes, so server errors here are rare (e.g. 50-entry soft cap).
 */
export function useBioPanelHandlers() {
  const { entries, createEntry, updateEntry, removeEntry } = useBioEntries();
  const [dialog, setDialog] = useState<BioDialogState>({ open: false });

  const openCreate = useCallback(() => {
    setDialog({ open: true, mode: "create" });
  }, []);
  const openEdit = useCallback((entry: BioEntry) => {
    setDialog({ open: true, mode: "edit", entry });
  }, []);
  const closeDialog = useCallback(() => {
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
      const editId =
        dialog.open && dialog.mode === "edit" ? dialog.entry._id : null;

      // Close dialog synchronously. The list update is already optimistic;
      // a rejection rolls back the patch and surfaces via toast below.
      setDialog({ open: false });

      try {
        if (editId !== null) {
          await updateEntry({ id: editId, ...args });
        } else {
          await createEntry(args);
        }
      } catch (err) {
        showToast({ type: "error", title: getMutationErrorMessage(err) });
      }
    },
    [createEntry, updateEntry, dialog],
  );

  return {
    entries,
    dialog,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
  };
}
