"use client";

import { useState, useCallback, useMemo } from "react";
import type { ArticleSummary } from "../types";
import type { SortOrder } from "./use-article-sort";

const PAGE_SIZE = 30;

export function useArticlePagination(
  allArticles: ArticleSummary[],
  sortOrder: SortOrder,
  preserveOrder = false,
) {
  const [page, setPage] = useState(1);

  // Reset page when filtered articles change (e.g. search query changes)
  // Uses React-recommended "store previous props" pattern instead of effect
  const [prevArticles, setPrevArticles] = useState(allArticles);
  if (prevArticles !== allArticles) {
    setPrevArticles(allArticles);
    setPage(1);
  }

  const sorted = useMemo(() => {
    if (preserveOrder) return allArticles;
    return [...allArticles].sort((a, b) => {
      const diff = (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
      return sortOrder === "newest" ? diff : -diff;
    });
  }, [allArticles, sortOrder, preserveOrder]);

  const articles = useMemo(
    () => sorted.slice(0, page * PAGE_SIZE),
    [sorted, page],
  );
  const hasMore = articles.length < sorted.length;

  const loadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  return { articles, hasMore, loadMore };
}
