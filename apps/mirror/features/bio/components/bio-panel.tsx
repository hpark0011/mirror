"use client";

import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { useIsProfileOwner } from "@/features/profile";
import { useBioPanelHandlers } from "../hooks/use-bio-panel-handlers";
import { MAX_BIO_ENTRIES } from "../hooks/use-bio-entries";
import { BioEntryList } from "./bio-entry-list";
import { BioAddEntryButton } from "./bio-add-entry-button";
import { BioEntryFormDialog } from "./bio-entry-form-dialog";
import { BioToolbar } from "./bio-toolbar";

export function BioPanel() {
  const isOwner = useIsProfileOwner();
  const {
    entries,
    canCreateEntry,
    dialog,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
    pendingDeletes,
  } = useBioPanelHandlers();

  const addDisabled = !canCreateEntry;
  const addDisabledReason = addDisabled
    ? `Bio entry limit reached (${MAX_BIO_ENTRIES}). Delete an entry to add another.`
    : undefined;

  return (
    <>
      <WorkspaceToolbar>
        <BioToolbar
          isOwner={isOwner}
          addDisabled={addDisabled}
          addDisabledReason={addDisabledReason}
          onAddClick={openCreate}
        />
      </WorkspaceToolbar>
      <div
        data-testid="bio-panel"
        className="flex flex-col gap-2 p-4 max-w-2xl mx-auto"
      >
        <BioEntryList
          entries={entries}
          isOwner={isOwner}
          onEdit={openEdit}
          onDelete={handleDelete}
          pendingDeletes={pendingDeletes}
          ownerEmptyAction={isOwner
            ? (
              <BioAddEntryButton
                onClick={openCreate}
                disabled={addDisabled}
                disabledReason={addDisabledReason}
              >
                Add your first entry
              </BioAddEntryButton>
            )
            : undefined}
        />

        {isOwner
          ? (
            <BioEntryFormDialog
              open={dialog.open}
              mode={dialog.open ? dialog.mode : "create"}
              entry={dialog.open && dialog.mode === "edit"
                ? dialog.entry
                : undefined}
              onOpenChange={(open) => {
                if (!open) closeDialog();
              }}
              onSubmit={handleSubmit}
            />
          )
          : null}
      </div>
    </>
  );
}
