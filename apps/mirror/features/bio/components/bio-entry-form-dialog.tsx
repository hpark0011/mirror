"use client";

import { useState, type ReactNode } from "react";
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
  errorSlot?: ReactNode;
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
  const { open, mode, entry, onOpenChange, onSubmit, errorSlot } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: BioEntryFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === "create" ? "Add bio entry" : "Edit bio entry";
  const description =
    mode === "create"
      ? "Add a work or education entry to your bio."
      : "Update this work or education entry.";
  const submitLabel = mode === "create" ? "Add" : "Save";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {errorSlot}
          <BioEntryForm
            // Re-mount the form when switching between entries so RHF resets.
            key={entry?._id ?? "new"}
            defaultValues={getDefaultValues(entry)}
            isSubmitting={isSubmitting}
            submitLabel={submitLabel}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
