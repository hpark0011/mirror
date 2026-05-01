"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@feel-good/ui/primitives/form";
import { Button } from "@feel-good/ui/primitives/button";
import {
  bioEntrySchema,
  type BioEntryFormValues,
} from "../lib/schemas/bio-entry.schema";
import { BioKindField } from "./bio-form-fields/bio-kind-field";
import { BioMonthYearField } from "./bio-form-fields/bio-month-year-field";
import { BioTextFields } from "./bio-form-fields/bio-text-fields";

type BioEntryFormProps = {
  defaultValues: BioEntryFormValues;
  submitLabel: string;
  onSubmit: (values: BioEntryFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export function BioEntryForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: BioEntryFormProps) {
  const form = useForm<BioEntryFormValues>({
    resolver: zodResolver(bioEntrySchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <BioKindField control={form.control} />
        <BioTextFields control={form.control} />
        <BioMonthYearField
          control={form.control}
          monthName="startMonth"
          yearName="startYear"
          label="Start"
          allowEmpty={false}
        />
        <BioMonthYearField
          control={form.control}
          monthName="endMonth"
          yearName="endYear"
          label="End (leave empty for Present)"
          allowEmpty
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
