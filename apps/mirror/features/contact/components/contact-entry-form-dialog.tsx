"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@feel-good/ui/primitives/dialog";
import { type ContactEntry, type ContactEntryKind } from "../types";
import { type ContactEntryFormValues } from "../lib/schemas/contact-entry.schema";
import { ContactEntryForm } from "./contact-entry-form";

type Mode = "create" | "edit";

type ContactEntryFormDialogProps = {
  open: boolean;
  mode: Mode;
  entry?: ContactEntry;
  /**
   * In create mode: the platforms NOT already used by this owner. In edit
   * mode: a single-element array containing the entry's current kind (the
   * form locks the kind field anyway).
   */
  availableKinds: ReadonlyArray<ContactEntryKind>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ContactEntryFormValues) => Promise<void>;
};

function getDefaultValues(
  mode: Mode,
  entry: ContactEntry | undefined,
  availableKinds: ReadonlyArray<ContactEntryKind>,
): ContactEntryFormValues {
  if (mode === "edit" && entry) {
    return { kind: entry.kind, value: entry.value };
  }
  // Pre-select the first available kind in create mode so the form always
  // has a valid kind even before the user clicks the select.
  const fallback: ContactEntryKind = availableKinds[0] ?? "email";
  return { kind: fallback, value: "" };
}

export function ContactEntryFormDialog(props: ContactEntryFormDialogProps) {
  const { open, mode, entry, availableKinds, onOpenChange, onSubmit } = props;

  const title = mode === "create" ? "Add contact" : "Edit contact";
  const description =
    mode === "create"
      ? "Add an email address or social profile link."
      : "Update this contact entry.";
  const submitLabel = mode === "create" ? "Add" : "Save";

  // In edit mode the kind field is locked and only renders the entry's
  // current kind. In create mode it renders the available-kinds list
  // (already filtered by `useContactEntries`).
  const kindsForForm: ReadonlyArray<ContactEntryKind> =
    mode === "edit" && entry ? [entry.kind] : availableKinds;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-4 pt-3">
        <DialogHeader className="mb-6 gap-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ContactEntryForm
            // Re-mount the form when switching between entries so RHF resets.
            key={entry?._id ?? "new"}
            defaultValues={getDefaultValues(mode, entry, availableKinds)}
            submitLabel={submitLabel}
            availableKinds={kindsForForm}
            kindLocked={mode === "edit"}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
