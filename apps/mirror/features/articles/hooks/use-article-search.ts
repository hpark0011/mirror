"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { getPlainText } from "@feel-good/features/editor/lib";
import type { Article } from "../lib/mock-articles";

export type UseArticleSearchReturn = {
  filteredArticles: Article[];
  query: string;
  setQuery: (q: string) => void;
  isOpen: boolean;
  isFiltered: boolean;
  open: () => void;
  close: () => void;
};

export function useArticleSearch(
  articles: Article[],
): UseArticleSearchReturn {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Precompute plain text once per articles change, avoiding re-parsing on each keystroke
  const searchableArticles = useMemo(
    () =>
      articles.map((article) => ({
        article,
        titleLower: article.title.toLowerCase(),
        bodyLower: getPlainText(article.body).toLowerCase(),
        categoryLower: article.category.toLowerCase(),
      })),
    [articles],
  );

  // Filter + sort by match priority (title > body > category)
  const filteredArticles = useMemo(() => {
    if (!debouncedQuery.trim()) return articles;

    const q = debouncedQuery.toLowerCase();

    // Single-pass: compute scores while filtering
    const scored = searchableArticles
      .map(({ article, titleLower, bodyLower, categoryLower }) => {
        if (
          titleLower.includes(q) ||
          bodyLower.includes(q) ||
          categoryLower.includes(q)
        ) {
          // Compute score based on match location (title > body > category)
          let score: number;
          if (titleLower.includes(q)) {
            score = 0;
          } else if (bodyLower.includes(q)) {
            score = 1;
          } else {
            score = 2;
          }
          return { article, score };
        }
        return null;
      })
      .filter((item) => item !== null);

    // Sort by precomputed scores
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
