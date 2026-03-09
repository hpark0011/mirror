"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, usePreloadedQuery } from "convex/react";
import type { Preloaded } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { SortOrder } from "../hooks/use-article-sort";
import type { ArticleSummary } from "../types";
import { useArticlePagination } from "../hooks/use-article-pagination";
import { useArticleSearch } from "../hooks/use-article-search";
import { useArticleSelection } from "../hooks/use-article-selection";
import { useArticleSort } from "../hooks/use-article-sort";
import { useArticleFilter } from "../hooks/use-article-filter";
import { filterArticles, getUniqueCategories } from "../utils/article-filter";
import { useIsProfileOwner } from "@/features/profile";
import { ArticleToolbarContext } from "./article-toolbar-context";
import { ArticleListContext } from "./article-list-context";

type ArticleWorkspaceProviderProps = {
  preloadedArticles: Preloaded<typeof api.articles.queries.getByUsername>;
  username: string;
  children: ReactNode;
};

export function ArticleWorkspaceProvider({
  preloadedArticles,
  username,
  children,
}: ArticleWorkspaceProviderProps) {
  const reactiveArticles = usePreloadedQuery(preloadedArticles);
  const articles = useMemo(
    () => ((reactiveArticles ?? []) as ArticleSummary[]),
    [reactiveArticles],
  );
  const isOwner = useIsProfileOwner();
  const removeArticles = useMutation(api.articles.mutations.remove);
  const search = useArticleSearch(articles);
  const { sortOrder, setSortOrder } = useArticleSort();
  const filter = useArticleFilter();
  const filteredByFilter = useMemo(
    () => filterArticles(search.filteredArticles, filter.filterState, isOwner),
    [search.filteredArticles, filter.filterState, isOwner],
  );
  const {
    articles: paginatedArticles,
    hasMore,
    loadMore,
  } = useArticlePagination(filteredByFilter, sortOrder, search.isFiltered);

  // Animation trigger on sort change
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  const allSlugs = useMemo(
    () => paginatedArticles.map((a) => a.slug),
    [paginatedArticles],
  );

  const selection = useArticleSelection(allSlugs);
  const { clear: clearSelection, selectedSlugs } = selection;

  const selectedSlugsRef = useRef(selectedSlugs);
  useEffect(() => {
    selectedSlugsRef.current = selectedSlugs;
  });

  const uniqueCategories = useMemo(
    () => getUniqueCategories(articles),
    [articles],
  );

  // Clear selection when search opens or filter changes
  const prevSearchOpen = useRef(search.isOpen);
  const prevFilterState = useRef(filter.filterState);
  useEffect(() => {
    if (search.isOpen && !prevSearchOpen.current) {
      clearSelection();
    }
    prevSearchOpen.current = search.isOpen;

    if (prevFilterState.current !== filter.filterState) {
      clearSelection();
    }
    prevFilterState.current = filter.filterState;
  }, [search.isOpen, filter.filterState, clearSelection]);

  const handleSortChange = useCallback(
    (order: SortOrder) => {
      setSortOrder(order);
      clearSelection();
      setShouldAnimate(true);
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      animationTimerRef.current = setTimeout(
        () => setShouldAnimate(false),
        1000,
      );
    },
    [setSortOrder, clearSelection],
  );

  const handleDelete = useCallback(() => {
    const currentSelection = selectedSlugsRef.current;
    const visibleSlugs = new Set(allSlugs);
    const idsToDelete = articles
      .filter(
        (a) => currentSelection.has(a.slug) && visibleSlugs.has(a.slug),
      )
      .map((a) => a._id);
    if (idsToDelete.length > 0) {
      void removeArticles({ ids: idsToDelete });
    }
    clearSelection();
  }, [clearSelection, allSlugs, articles, removeArticles]);

  // Empty state derivations
  const hasNoArticles = articles.length === 0;

  const showEmpty =
    paginatedArticles.length === 0 &&
    (search.query.trim() !== "" || filter.hasActiveFilters);

  const emptyMessage =
    search.query.trim() !== "" && filter.hasActiveFilters
      ? "No articles match your search and filters"
      : filter.hasActiveFilters
        ? "No articles match the current filters"
        : "No articles found";

  const toolbarValue = useMemo(
    () => ({
      isOwner,
      sortOrder,
      onSortChange: handleSortChange,
      search,
      filter,
      categories: uniqueCategories,
      selectedCount: selectedSlugs.size,
      onDelete: handleDelete,
    }),
    [
      isOwner,
      sortOrder,
      handleSortChange,
      search,
      filter,
      uniqueCategories,
      selectedSlugs.size,
      handleDelete,
    ],
  );

  const listValue = useMemo(
    () => ({
      articles: paginatedArticles,
      hasMore,
      onLoadMore: loadMore,
      username,
      isOwner,
      isAllSelected: selection.isAllSelected,
      isIndeterminate: selection.isIndeterminate,
      onToggleAll: selection.toggleAll,
      isSelected: selection.isSelected,
      onToggle: selection.toggle,
      shouldAnimate,
      hasNoArticles,
      showEmpty,
      emptyMessage,
    }),
    [
      paginatedArticles,
      hasMore,
      loadMore,
      username,
      isOwner,
      selection.isAllSelected,
      selection.isIndeterminate,
      selection.toggleAll,
      selection.isSelected,
      selection.toggle,
      shouldAnimate,
      hasNoArticles,
      showEmpty,
      emptyMessage,
    ],
  );

  return (
    <ArticleToolbarContext.Provider value={toolbarValue}>
      <ArticleListContext.Provider value={listValue}>
        {children}
      </ArticleListContext.Provider>
    </ArticleToolbarContext.Provider>
  );
}
