"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { ArticleSummary } from "../types";

export type UseArticleSearchReturn = {
  filteredArticles: ArticleSummary[];
  query: string;
  setQuery: (q: string) => void;
  isOpen: boolean;
  isFiltered: boolean;
  open: () => void;
  close: () => void;
};

export function useArticleSearch(
  articles: ArticleSummary[],
): UseArticleSearchReturn {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Precompute lowercase fields once per articles change.
  const searchableArticles = useMemo(
    () =>
      articles.map((article) => ({
        article,
        titleLower: article.title.toLowerCase(),
        categoryLower: article.category.toLowerCase(),
      })),
    [articles],
  );

  // Filter + sort by match priority (title > category)
  const filteredArticles = useMemo(() => {
    if (!debouncedQuery.trim()) return articles;

    const q = debouncedQuery.toLowerCase();

    const scored = searchableArticles
      .map(({ article, titleLower, categoryLower }) => {
        if (titleLower.includes(q)) return { article, score: 0 };
        if (categoryLower.includes(q)) return { article, score: 1 };
        return null;
      })
      .filter((item) => item !== null);

    scored.sort((a, b) => a.score - b.score);

    return scored.map((item) => item.article);
  }, [articles, searchableArticles, debouncedQuery]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const isFiltered = debouncedQuery.trim() !== "";

  return useMemo(
    () => ({ filteredArticles, query, setQuery, isOpen, isFiltered, open, close }),
    [filteredArticles, query, setQuery, isOpen, isFiltered, open, close],
  );
}
