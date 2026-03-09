"use client";

import { useState } from "react";

export type SortOrder = "newest" | "oldest";

export function usePostSort(defaultOrder: SortOrder = "newest") {
  const [sortOrder, setSortOrder] = useState<SortOrder>(defaultOrder);
  return { sortOrder, setSortOrder };
}
