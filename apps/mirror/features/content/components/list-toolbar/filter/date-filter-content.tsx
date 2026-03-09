"use client";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@feel-good/ui/primitives/dropdown-menu";
import type { DatePreset } from "@/features/content/utils/date-preset";

type ContentDateFilterContentProps = {
  value: DatePreset | null;
  onChange: (preset: DatePreset | null) => void;
};

function isDatePreset(value: unknown): value is DatePreset {
  return (
    value === "today" ||
    value === "this_week" ||
    value === "this_month" ||
    value === "this_year"
  );
}

export function ContentDateFilterContent({
  value,
  onChange,
}: ContentDateFilterContentProps) {
  return (
    <DropdownMenuRadioGroup
      value={value ?? "any_time"}
      onValueChange={(nextValue) => {
        if (nextValue === "any_time") {
          onChange(null);
        } else if (isDatePreset(nextValue)) {
          onChange(nextValue);
        }
      }}
    >
      <DropdownMenuRadioItem value="any_time">
        Any time
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="today">Today</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="this_week">
        This week
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="this_month">
        This month
      </DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="this_year">
        This year
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}
