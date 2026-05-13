"use client";

import { useCallback, useRef, useState } from "react";
import { showToast } from "@feel-good/ui/components/toast";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { getMutationErrorMessage } from "@/lib/get-mutation-error-message";
import { useContactEntries } from "./use-contact-entries";
import { type ContactEntry } from "../types";
import { type ContactEntryFormValues } from "../lib/schemas/contact-entry.schema";

export type ContactDialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; entry: ContactEntry };

/**
 * Drives `<ContactPanel>`'s dialog + mutation flow. Mirrors
 * `use-bio-panel-handlers.ts`: the dialog closes synchronously on submit,
 * the list updates optimistically via `withOptimisticUpdate`, and any
 * server rejection rolls the patch back and surfaces via toast.
 */
export function useContactPanelHandlers() {
  const {
    entries,
    availableKinds,
    canCreateEntry,
    createEntry,
    updateEntry,
    removeEntry,
  } = useContactEntries();
  const [dialog, setDialog] = useState<ContactDialogState>({ open: false });
  const [pendingDeletes, setPendingDeletes] = useState<
    ReadonlySet<Id<"contactEntries">>
  >(() => new Set());
  // Ref-based synchronous gate against rapid double-click — same pattern as
  // bio. The setState updater is StrictMode-unsafe for "did I add this id?"
  // checks.
  const pendingDeletesRef = useRef<Set<Id<"contactEntries">>>(new Set());

  const openCreate = useCallback(() => {
    setDialog({ open: true, mode: "create" });
  }, []);
  const openEdit = useCallback((entry: ContactEntry) => {
    setDialog({ open: true, mode: "edit", entry });
  }, []);
  const closeDialog = useCallback(() => {
    setDialog({ open: false });
  }, []);

  const handleDelete = useCallback(
    async (entry: ContactEntry) => {
      if (pendingDeletesRef.current.has(entry._id)) return;
      pendingDeletesRef.current.add(entry._id);
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        next.add(entry._id);
        return next;
      });

      try {
        await removeEntry({ id: entry._id });
      } catch (err) {
        showToast({ type: "error", title: getMutationErrorMessage(err) });
      } finally {
        pendingDeletesRef.current.delete(entry._id);
        setPendingDeletes((prev) => {
          if (!prev.has(entry._id)) return prev;
          const next = new Set(prev);
          next.delete(entry._id);
          return next;
        });
      }
    },
    [removeEntry],
  );

  const handleSubmit = useCallback(
    async (values: ContactEntryFormValues) => {
      const editId =
        dialog.open && dialog.mode === "edit" ? dialog.entry._id : null;

      // Close dialog synchronously. The list update is already optimistic;
      // a rejection rolls back the patch and surfaces via toast below.
      setDialog({ open: false });

      try {
        if (editId !== null) {
          await updateEntry({ id: editId, value: values.value.trim() });
        } else {
          await createEntry({ kind: values.kind, value: values.value.trim() });
        }
      } catch (err) {
        showToast({ type: "error", title: getMutationErrorMessage(err) });
      }
    },
    [createEntry, updateEntry, dialog],
  );

  return {
    entries,
    availableKinds,
    canCreateEntry,
    dialog,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
    pendingDeletes,
  };
}
