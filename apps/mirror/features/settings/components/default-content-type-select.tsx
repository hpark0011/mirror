"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";
import { type DefaultProfileSection } from "@feel-good/convex/convex/content/href";

type DefaultContentTypeSelectProps = {
  value: DefaultProfileSection;
  onChange: (value: DefaultProfileSection) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ value: DefaultProfileSection; label: string }> = [
  { value: "bio", label: "Bio" },
  { value: "posts", label: "Posts" },
  { value: "articles", label: "Articles" },
];

export function DefaultContentTypeSelect({
  value,
  onChange,
  disabled = false,
}: DefaultContentTypeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        onChange(nextValue as DefaultProfileSection);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className="w-full"
        data-testid="default-content-type-select"
      >
        <SelectValue placeholder="Select default content type" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
