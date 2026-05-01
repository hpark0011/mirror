"use client";

import { useMemo } from "react";
import { type Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { type BioEntryFormValues } from "../../lib/schemas/bio-entry.schema";
import { BioMonthYearSelect } from "./bio-month-year-select";

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
] as const;

type BioMonthYearFieldProps = {
  control: Control<BioEntryFormValues>;
  monthName: "startMonth" | "endMonth";
  yearName: "startYear" | "endYear";
  label: string;
  allowEmpty: boolean;
};

export function BioMonthYearField({
  control,
  monthName,
  yearName,
  label,
  allowEmpty,
}: BioMonthYearFieldProps) {
  const yearOptions = useMemo(() => {
    const max = new Date().getUTCFullYear() + 1;
    const arr: { value: number; label: string }[] = [];
    for (let y = max; y >= 1900; y--) arr.push({ value: y, label: String(y) });
    return arr;
  }, []);

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="grid grid-cols-2 gap-2">
        <FormField
          control={control}
          name={monthName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormControl>
                <BioMonthYearSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Month"
                  options={MONTHS}
                  allowEmpty={allowEmpty}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={yearName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormControl>
                <BioMonthYearSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Year"
                  options={yearOptions}
                  allowEmpty={allowEmpty}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </FormItem>
  );
}
