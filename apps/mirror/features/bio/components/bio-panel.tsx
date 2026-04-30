"use client";

import { useIsProfileOwner } from "@/features/profile";
import { useBioPanelHandlers } from "../hooks/use-bio-panel-handlers";
import { BioEntryList } from "./bio-entry-list";
import { BioAddEntryButton } from "./bio-add-entry-button";
import { BioEntryFormDialog } from "./bio-entry-form-dialog";
import { BioFormError } from "./bio-form-error";

export function BioPanel() {
  const isOwner = useIsProfileOwner();
  const {
    entries,
    dialog,
    formError,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
  } = useBioPanelHandlers();

  return (
    <div data-testid="bio-panel" className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bio</h2>
          <p className="text-sm text-muted-foreground">
            Work and education history.
          </p>
        </div>
        {isOwner ? <BioAddEntryButton onClick={openCreate} /> : null}
      </header>

      <BioEntryList
        entries={entries}
        isOwner={isOwner}
        onEdit={openEdit}
        onDelete={handleDelete}
        ownerEmptyAction={
          isOwner ? (
            <BioAddEntryButton onClick={openCreate}>
              Add your first entry
            </BioAddEntryButton>
          ) : undefined
        }
      />

      {isOwner ? (
        <BioEntryFormDialog
          open={dialog.open}
          mode={dialog.open ? dialog.mode : "create"}
          entry={
            dialog.open && dialog.mode === "edit" ? dialog.entry : undefined
          }
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
          onSubmit={handleSubmit}
          errorSlot={<BioFormError message={formError} />}
        />
      ) : null}
    </div>
  );
}
