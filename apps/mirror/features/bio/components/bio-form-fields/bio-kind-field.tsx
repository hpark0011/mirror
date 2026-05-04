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
import { type BioEntryFormValues } from "../../lib/schemas/bio-entry.schema";

type BioKindFieldProps = {
  control: Control<BioEntryFormValues>;
};

export function BioKindField({ control }: BioKindFieldProps) {
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
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                className="w-full border-border-subtle dark:border-border px-1"
                size="sm"
                variant="underline"
              >
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="education">Education</SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
