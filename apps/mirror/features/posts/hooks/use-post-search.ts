"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PostSummary } from "../types";

export type UsePostSearchReturn = {
  filteredPosts: PostSummary[];
  query: string;
  setQuery: (query: string) => void;
  isOpen: boolean;
  isFiltered: boolean;
  open: () => void;
  close: () => void;
};

export function usePostSearch(posts: PostSummary[]): UsePostSearchReturn {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const searchablePosts = useMemo(
    () =>
      posts.map((post) => ({
        post,
        titleLower: post.title.toLowerCase(),
        categoryLower: post.category.toLowerCase(),
      })),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return posts;
    }

    const normalizedQuery = debouncedQuery.toLowerCase();

    const scoredPosts = searchablePosts
      .map(({ post, titleLower, categoryLower }) => {
        if (titleLower.includes(normalizedQuery)) {
          return { post, score: 0 };
        }

        if (categoryLower.includes(normalizedQuery)) {
          return { post, score: 1 };
        }

        return null;
      })
      .filter((entry) => entry !== null);

    scoredPosts.sort((left, right) => left.score - right.score);

    return scoredPosts.map((entry) => entry.post);
  }, [debouncedQuery, posts, searchablePosts]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const isFiltered = debouncedQuery.trim() !== "";

  return useMemo(
    () => ({
      filteredPosts,
      query,
      setQuery,
      isOpen,
      isFiltered,
      open,
      close,
    }),
    [filteredPosts, query, isOpen, isFiltered, open, close],
  );
}
