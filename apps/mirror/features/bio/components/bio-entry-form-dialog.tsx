"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@feel-good/ui/primitives/dialog";
import { type BioEntry } from "../types";
import { type BioEntryFormValues } from "../lib/schemas/bio-entry.schema";
import { epochMsToMonthYear } from "../utils/month-year";
import { BioEntryForm } from "./bio-entry-form";

type Mode = "create" | "edit";

type BioEntryFormDialogProps = {
  open: boolean;
  mode: Mode;
  entry?: BioEntry;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: BioEntryFormValues) => Promise<void>;
};

// Cleared optional fields default to `""` (NOT `undefined`) so the Wave-1
// `update` mutation, which treats `args.X !== undefined` as "patch this
// field," actually clears `description` / `link` when the user blanks them.
function getDefaultValues(entry?: BioEntry): BioEntryFormValues {
  const start = entry ? epochMsToMonthYear(entry.startDate) : null;
  const end = entry?.endDate != null ? epochMsToMonthYear(entry.endDate) : null;
  return {
    kind: entry?.kind ?? "work",
    title: entry?.title ?? "",
    startMonth: start?.month ?? 1,
    startYear: start?.year ?? new Date().getUTCFullYear(),
    endMonth: end?.month ?? null,
    endYear: end?.year ?? null,
    description: entry?.description ?? "",
    link: entry?.link ?? "",
  };
}

export function BioEntryFormDialog(props: BioEntryFormDialogProps) {
  const { open, mode, entry, onOpenChange, onSubmit } = props;

  const title = mode === "create" ? "Add bio entry" : "Edit bio entry";
  const description = mode === "create"
    ? "Add a work or education entry to your bio."
    : "Update this work or education entry.";
  const submitLabel = mode === "create" ? "Add" : "Save";

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
          <BioEntryForm
            // Re-mount the form when switching between entries so RHF resets.
            key={entry?._id ?? "new"}
            defaultValues={getDefaultValues(entry)}
            submitLabel={submitLabel}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
