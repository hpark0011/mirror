"use client";

import { type Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { Input } from "@feel-good/ui/primitives/input";
import { Textarea } from "@feel-good/ui/primitives/textarea";
import { type BioEntryFormValues } from "../../lib/schemas/bio-entry.schema";

type BioTextFieldsProps = {
  control: Control<BioEntryFormValues>;
};

export function BioTextFields({ control }: BioTextFieldsProps) {
  return (
    <>
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Senior Engineer at Acme"
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description (optional)</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Short description of what you did or studied."
                rows={3}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="link"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Link (optional)</FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="url"
                placeholder="https://example.com"
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
