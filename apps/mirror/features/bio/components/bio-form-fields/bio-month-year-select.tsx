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

type BioMonthYearSelectProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder: string;
  options: ReadonlyArray<Option>;
  allowEmpty: boolean;
};

export function BioMonthYearSelect({
  value,
  onChange,
  placeholder,
  options,
  allowEmpty,
}: BioMonthYearSelectProps) {
  return (
    <Select
      value={value === null ? EMPTY : String(value)}
      onValueChange={(v) => onChange(v === EMPTY ? null : Number(v))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value={EMPTY}>Present</SelectItem> : null}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
