"use client";

import { createContext, useContext } from "react";
import type { SortOrder } from "../hooks/use-article-sort";
import type { UseArticleSearchReturn } from "../hooks/use-article-search";
import type { UseArticleFilterReturn } from "../hooks/use-article-filter";

export type ArticleToolbarContextValue = {
  isOwner: boolean;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UseArticleSearchReturn;
  filter: UseArticleFilterReturn;
  categories: { name: string; count: number }[];
  selectedCount: number;
  onDelete: () => void;
};

export const ArticleToolbarContext =
  createContext<ArticleToolbarContextValue | null>(null);

export function useArticleToolbar() {
  const context = useContext(ArticleToolbarContext);
  if (!context) {
    throw new Error(
      "useArticleToolbar must be used within ArticleWorkspaceProvider",
    );
  }
  return context;
}
