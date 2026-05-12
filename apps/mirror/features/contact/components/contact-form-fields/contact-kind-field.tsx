"use client";

import { type Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";
import { type ContactEntryFormValues } from "../../lib/schemas/contact-entry.schema";
import { CONTACT_KIND_PRESENTATION } from "../../lib/contact-kind-presentation";
import { type ContactEntryKind } from "../../types";

type ContactKindFieldProps = {
  control: Control<ContactEntryFormValues>;
  /**
   * The platforms the user is allowed to pick. In create mode this is the
   * full set minus already-used kinds (one-per-platform precondition). In
   * edit mode the parent passes a single-element array containing only the
   * entry's existing kind, and the field is rendered disabled.
   */
  availableKinds: ReadonlyArray<ContactEntryKind>;
  disabled?: boolean;
};

export function ContactKindField({
  control,
  availableKinds,
  disabled,
}: ContactKindFieldProps) {
  return (
    <FormField
      control={control}
      name="kind"
      render={({ field }) => (
        <FormItem className="flex">
          <FormLabel className="w-40 gap-0.5">
            Kind
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FormLabel>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger
                className="w-full border-border-subtle dark:border-border px-1"
                size="sm"
                variant="underline"
                data-testid="contact-kind-trigger"
              >
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                {availableKinds.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {CONTACT_KIND_PRESENTATION[kind].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
