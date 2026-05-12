"use client";

import { type Control, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { Input } from "@feel-good/ui/primitives/input";
import { type ContactEntryFormValues } from "../../lib/schemas/contact-entry.schema";
import { CONTACT_KIND_PRESENTATION } from "../../lib/contact-kind-presentation";

type ContactValueFieldProps = {
  control: Control<ContactEntryFormValues>;
};

export function ContactValueField({ control }: ContactValueFieldProps) {
  // The label and placeholder follow the current kind selection. Email gets
  // a `type="email"` input so mobile keyboards switch layout; URL kinds use
  // `inputMode="url"` for the same reason. `useWatch` keeps the field in
  // sync without re-rendering the whole form.
  const kind = useWatch({ control, name: "kind" });
  const presentation = CONTACT_KIND_PRESENTATION[kind];
  const isEmail = kind === "email";

  return (
    <FormField
      control={control}
      name="value"
      render={({ field }) => (
        <FormItem className="flex">
          <FormLabel className="w-40 gap-0.5">
            {presentation.label}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type={isEmail ? "email" : "url"}
              inputMode={isEmail ? "email" : "url"}
              placeholder={presentation.placeholder}
              autoComplete="off"
              size="sm"
              variant="underline"
              className="border-border-subtle dark:border-border px-1 focus-visible:bg-gray-4 focus-visible:rounded-md"
              data-testid="contact-value-input"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
