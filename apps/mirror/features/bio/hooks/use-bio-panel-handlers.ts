"use client";

import { useCallback, useRef, useState } from "react";
import { showToast } from "@feel-good/ui/components/toast";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
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
  const { entries, canCreateEntry, createEntry, updateEntry, removeEntry } =
    useBioEntries();
  const [dialog, setDialog] = useState<BioDialogState>({ open: false });
  // In-flight deletes — used to gate `handleDelete` so a rapid second
  // click on the same row is a no-op, and to disable the per-row
  // Delete button while its mutation is pending. Without this guard,
  // the second `removeEntry({ id })` call resolves on the server with
  // `Bio entry not found` (the row was deleted by call #1), surfacing
  // a spurious error toast for an operation the user perceives as
  // successful. See ticket FG_088.
  const [pendingDeletes, setPendingDeletes] = useState<
    ReadonlySet<Id<"bioEntries">>
  >(() => new Set());
  // Synchronous gate — the React `setState` updater can run twice in
  // StrictMode, so it isn't safe to derive "did I add this id?" from
  // inside the updater. The ref is the source of truth for "is this
  // id in flight right now", and `pendingDeletes` state mirrors it
  // for rendering the per-row `disabled` prop.
  const pendingDeletesRef = useRef<Set<Id<"bioEntries">>>(new Set());

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
      // Ref-based gate — synchronous and StrictMode-safe (unlike a
      // side-effecting setState updater). A rapid second click on the
      // same row before the first mutation resolves is a no-op.
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
