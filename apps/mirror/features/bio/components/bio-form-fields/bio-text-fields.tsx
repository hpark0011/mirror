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
          <FormItem className="flex">
            <FormLabel className="w-40 gap-0.5">
              Title
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Senior Engineer at Acme"
                autoComplete="off"
                size="sm"
                className="border-border-subtle dark:border-border px-1 focus-visible:bg-gray-4 focus-visible:rounded-md"
                variant="underline"
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
          <FormItem className="flex items-start py-4 pb-2">
            <FormLabel className="w-40 pt-1.5">Description</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Short description of what you did or studied."
                className="border-border-subtle dark:border-border min-h-[120px] max-h-[120px] rounded-[10px] resize-none"
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
          <FormItem className="flex">
            <FormLabel className="w-40">Link</FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="url"
                placeholder="https://example.com"
                autoComplete="off"
                className="border-border-subtle dark:border-border px-1 focus-visible:bg-gray-4 focus-visible:rounded-md"
                size="sm"
                variant="underline"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
