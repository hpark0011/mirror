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
import { type ProjectFormValues } from "../../lib/schemas/project.schema";
import { ProjectMonthYearSelect } from "./project-month-year-select";

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

type ProjectMonthYearFieldProps = {
  control: Control<ProjectFormValues>;
  monthName: "startMonth" | "endMonth";
  yearName: "startYear" | "endYear";
  label: string;
  allowEmpty: boolean;
  required?: boolean;
};

export function ProjectMonthYearField({
  control,
  monthName,
  yearName,
  label,
  allowEmpty,
  required = false,
}: ProjectMonthYearFieldProps) {
  const yearOptions = useMemo(() => {
    const max = new Date().getUTCFullYear() + 1;
    const options: { value: number; label: string }[] = [];
    for (let year = max; year >= 1900; year--) {
      options.push({ value: year, label: String(year) });
    }
    return options;
  }, []);

  return (
    <FormItem className="flex items-baseline gap-1.5">
      <FormLabel className="w-40 gap-0.5">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </FormLabel>
      <div className="grid grid-cols-2 gap-3 w-full">
        <FormField
          control={control}
          name={monthName}
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormControl>
                <ProjectMonthYearSelect
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
                <ProjectMonthYearSelect
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
