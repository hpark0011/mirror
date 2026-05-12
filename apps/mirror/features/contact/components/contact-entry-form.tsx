"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@feel-good/ui/primitives/form";
import { Button } from "@feel-good/ui/primitives/button";
import {
  type ContactEntryFormValues,
  contactEntrySchema,
} from "../lib/schemas/contact-entry.schema";
import { type ContactEntryKind } from "../types";
import { ContactKindField } from "./contact-form-fields/contact-kind-field";
import { ContactValueField } from "./contact-form-fields/contact-value-field";

type ContactEntryFormProps = {
  defaultValues: ContactEntryFormValues;
  submitLabel: string;
  availableKinds: ReadonlyArray<ContactEntryKind>;
  /**
   * In edit mode the kind field is read-only — changing the platform of an
   * existing entry would need to delete + re-insert to preserve the
   * one-per-platform invariant. The form keeps the kind locked instead.
   */
  kindLocked: boolean;
  onSubmit: (values: ContactEntryFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export function ContactEntryForm({
  defaultValues,
  submitLabel,
  availableKinds,
  kindLocked,
  onSubmit,
  onCancel,
}: ContactEntryFormProps) {
  const form = useForm<ContactEntryFormValues>({
    resolver: zodResolver(contactEntrySchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <ContactKindField
          control={form.control}
          availableKinds={availableKinds}
          disabled={kindLocked}
        />
        <ContactValueField control={form.control} />

        <div className="flex items-center justify-end gap-1 pt-2">
          {onCancel
            ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                className="bg-dialog w-14"
                size="xs"
              >
                Cancel
              </Button>
            )
            : null}
          <Button type="submit" variant="primary" className="w-14" size="xs">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
