"use client";

import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { useIsProfileOwner } from "@/features/profile";
import { useContactPanelHandlers } from "../hooks/use-contact-panel-handlers";
import { ContactEntryList } from "./contact-entry-list";
import { ContactAddEntryButton } from "./contact-add-entry-button";
import { ContactEntryFormDialog } from "./contact-entry-form-dialog";
import { ContactToolbar } from "./contact-toolbar";

export function ContactPanel() {
  const isOwner = useIsProfileOwner();
  const {
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
  } = useContactPanelHandlers();

  const addDisabled = !canCreateEntry;
  const addDisabledReason = addDisabled
    ? "All platforms are already added. Delete one to add another."
    : undefined;

  return (
    <>
      <WorkspaceToolbar>
        <ContactToolbar
          isOwner={isOwner}
          addDisabled={addDisabled}
          addDisabledReason={addDisabledReason}
          onAddClick={openCreate}
        />
      </WorkspaceToolbar>
      <div
        data-testid="contact-panel"
        className="flex flex-col gap-2 p-4 max-w-2xl mx-auto py-12 h-full"
      >
        {entries.length !== 0 && (
          <p className="text-[15px] mb-4">
            Email and social profile links.
          </p>
        )}

        <ContactEntryList
          entries={entries}
          isOwner={isOwner}
          onEdit={openEdit}
          onDelete={handleDelete}
          pendingDeletes={pendingDeletes}
          ownerEmptyAction={isOwner
            ? (
              <ContactAddEntryButton
                onClick={openCreate}
                disabled={addDisabled}
                disabledReason={addDisabledReason}
              >
                Add first contact
              </ContactAddEntryButton>
            )
            : undefined}
        />

        {isOwner
          ? (
            <ContactEntryFormDialog
              open={dialog.open}
              mode={dialog.open ? dialog.mode : "create"}
              entry={dialog.open && dialog.mode === "edit"
                ? dialog.entry
                : undefined}
              availableKinds={availableKinds}
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
