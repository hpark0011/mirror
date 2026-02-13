"use client";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@feel-good/ui/primitives/dropdown-menu";

type PublishedStatus = "draft" | "published";

type StatusFilterContentProps = {
  value: PublishedStatus | null;
  onChange: (status: PublishedStatus | null) => void;
};

function isPublishedStatus(value: unknown): value is PublishedStatus {
  return value === "draft" || value === "published";
}

export function StatusFilterContent({
  value,
  onChange,
}: StatusFilterContentProps) {
  return (
    <DropdownMenuRadioGroup
      value={value ?? "all"}
      onValueChange={(val) => {
        if (val === "all") {
          onChange(null);
        } else if (isPublishedStatus(val)) {
          onChange(val);
        }
      }}
    >
      <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="draft">Draft</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="published">Published</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}
