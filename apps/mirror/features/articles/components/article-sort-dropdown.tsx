"use client";

import { ContentListSortDropdown, type SortOrder } from "@/features/content";

type ArticleSortDropdownProps = {
  value: SortOrder;
  onChange: (order: SortOrder) => void;
};

export function ArticleSortDropdown({
  value,
  onChange,
}: ArticleSortDropdownProps) {
  return <ContentListSortDropdown value={value} onChange={onChange} />;
}
