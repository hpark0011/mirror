"use client";

import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@feel-good/ui/primitives/dropdown-menu";

type PublishedStatus = "draft" | "published";

type ContentStatusFilterContentProps = {
  value: PublishedStatus | null;
  onChange: (status: PublishedStatus | null) => void;
};

function isPublishedStatus(value: unknown): value is PublishedStatus {
  return value === "draft" || value === "published";
}

export function ContentStatusFilterContent({
  value,
  onChange,
}: ContentStatusFilterContentProps) {
  return (
    <DropdownMenuRadioGroup
      value={value ?? "all"}
      onValueChange={(nextValue) => {
        if (nextValue === "all") {
          onChange(null);
        } else if (isPublishedStatus(nextValue)) {
          onChange(nextValue);
        }
      }}
    >
      <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="draft">Draft</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="published">Published</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  );
}
