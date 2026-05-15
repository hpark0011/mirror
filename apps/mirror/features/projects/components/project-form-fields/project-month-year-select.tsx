"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";

const EMPTY = "__empty__";

type Option = { value: number; label: string };

type ProjectMonthYearSelectProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  options: ReadonlyArray<Option>;
  allowEmpty: boolean;
};

export function ProjectMonthYearSelect({
  value,
  onChange,
  placeholder,
  options,
  allowEmpty,
}: ProjectMonthYearSelectProps) {
  return (
    <Select
      value={value === null ? EMPTY : String(value)}
      onValueChange={(next) => onChange(next === EMPTY ? null : Number(next))}
    >
      <SelectTrigger
        className="w-full border-border-subtle px-1 dark:border-border"
        size="sm"
        variant="underline"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value={EMPTY}>Present</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
