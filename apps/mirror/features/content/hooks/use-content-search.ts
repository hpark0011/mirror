"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DEBOUNCE_MS = 300;

export type UseContentSearchReturn<T> = {
  filteredItems: T[];
  query: string;
  setQuery: (query: string) => void;
  isOpen: boolean;
  isFiltered: boolean;
  open: () => void;
  close: () => void;
};

/**
 * Debounced, score-sorted substring search over arbitrary content items.
 *
 * `getSearchableFields(item)` returns an ordered array of strings to match
 * against — earlier entries score higher (lower index = higher priority).
 * The hook precomputes lowercased fields once per `items` change.
 */
export function useContentSearch<T>(
  items: T[],
  getSearchableFields: (item: T) => string[],
): UseContentSearchReturn<T> {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searchableItems = useMemo(
    () =>
      items.map((item) => ({
        item,
        fieldsLower: getSearchableFields(item).map((field) =>
          field.toLowerCase(),
        ),
      })),
    [items, getSearchableFields],
  );

  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return items;
    }

    const normalizedQuery = debouncedQuery.toLowerCase();

    const scored = searchableItems
      .map(({ item, fieldsLower }) => {
        for (let index = 0; index < fieldsLower.length; index += 1) {
          if (fieldsLower[index].includes(normalizedQuery)) {
            return { item, score: index };
          }
        }
        return null;
      })
      .filter((entry) => entry !== null);

    scored.sort((left, right) => left.score - right.score);

    return scored.map((entry) => entry.item);
  }, [debouncedQuery, items, searchableItems]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const isFiltered = debouncedQuery.trim() !== "";

  return useMemo(
    () => ({
      filteredItems,
      query,
      setQuery,
      isOpen,
      isFiltered,
      open,
      close,
    }),
    [filteredItems, query, isOpen, isFiltered, open, close],
  );
}
