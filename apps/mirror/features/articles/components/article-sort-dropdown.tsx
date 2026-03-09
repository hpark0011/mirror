"use client";

import { ContentListSortDropdown } from "@/features/content";
import type { SortOrder } from "../hooks/use-article-sort";

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
