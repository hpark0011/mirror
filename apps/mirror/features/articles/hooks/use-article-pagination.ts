"use client";

import { useCallback, useMemo, useState } from "react";
import type { ArticleSummary } from "../types";

const PAGE_SIZE = 30;

export function useArticlePagination(allArticles: ArticleSummary[]) {
  const [page, setPage] = useState(1);

  // Reset page when filtered articles change (e.g. search query changes)
  // Uses React-recommended "store previous props" pattern instead of effect
  const [prevArticles, setPrevArticles] = useState(allArticles);
  if (prevArticles !== allArticles) {
    setPrevArticles(allArticles);
    setPage(1);
  }

  const articles = useMemo(
    () => allArticles.slice(0, page * PAGE_SIZE),
    [allArticles, page],
  );
  const hasMore = articles.length < allArticles.length;

  const loadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  return { articles, hasMore, loadMore };
}
