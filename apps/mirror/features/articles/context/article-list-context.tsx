"use client";

import { createContext, useContext } from "react";
import type { ArticleSummary } from "../types";

export type ArticleListContextValue = {
  articles: ArticleSummary[];
  hasMore: boolean;
  onLoadMore: () => void;
  username: string;
  isOwner: boolean;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleAll: () => void;
  isSelected: (slug: string) => boolean;
  onToggle: (slug: string) => void;
  shouldAnimate: boolean;
  hasNoArticles: boolean;
  showEmpty: boolean;
  emptyMessage: string;
};

export const ArticleListContext =
  createContext<ArticleListContextValue | null>(null);

export function useArticleList() {
  const context = useContext(ArticleListContext);
  if (!context) {
    throw new Error(
      "useArticleList must be used within ArticleWorkspaceProvider",
    );
  }
  return context;
}
