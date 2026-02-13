"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { SortOrder } from "../hooks/use-article-sort";
import type { Article } from "../lib/mock-articles";
import { useArticleList } from "../hooks/use-article-list";
import { useArticleSearch } from "../hooks/use-article-search";
import { useArticleSelection } from "../hooks/use-article-selection";
import { useArticleSort } from "../hooks/use-article-sort";
import { useArticleFilter } from "../hooks/use-article-filter";
import { filterArticles, getUniqueCategories } from "../utils/article-filter";
import { useIsProfileOwner } from "@/features/profile";
import { ArticleListView } from "../views/article-list-view";
import { ArticleToolbar } from "./article-toolbar";
import { useScrollRoot } from "../context/scroll-root-context";

type ScrollableArticleListProps = {
  articles: Article[];
  username: string;
};

export function ScrollableArticleList({
  articles: initialArticles,
  username,
}: ScrollableArticleListProps) {
  const [articles, setArticles] = useState(initialArticles);
  const isOwner = useIsProfileOwner();
  const search = useArticleSearch(articles);
  const { sortOrder, setSortOrder } = useArticleSort();
  const filter = useArticleFilter();
  const filteredByFilter = useMemo(
    () => filterArticles(search.filteredArticles, filter.filterState, isOwner),
    [search.filteredArticles, filter.filterState, isOwner],
  );
  const { articles: paginatedArticles, hasMore, loadMore } = useArticleList(
    filteredByFilter,
    sortOrder,
    search.isFiltered,
  );
  const scrollRoot = useScrollRoot();

  // Animation trigger on sort change — driven from event handler, not effect
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  // Compute unique categories once and pass down instead of full articles array
  const uniqueCategories = useMemo(
    () => getUniqueCategories(articles),
    [articles],
  );

  // Clear selection when search opens or filter changes
  const prevSearchOpen = useRef(search.isOpen);
  const prevFilterState = useRef(filter.filterState);
  useEffect(() => {
    if (search.isOpen && !prevSearchOpen.current) {
      selection.clear();
    }
    prevSearchOpen.current = search.isOpen;

    if (prevFilterState.current !== filter.filterState) {
      selection.clear();
    }
    prevFilterState.current = filter.filterState;
  }, [search.isOpen, filter.filterState, selection]);

  const handleSortChange = useCallback(
    (order: SortOrder) => {
      setSortOrder(order);
      selection.clear();
      setShouldAnimate(true);
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      animationTimerRef.current = setTimeout(
        () => setShouldAnimate(false),
        1000,
      );
    },
    [setSortOrder, selection],
  );

  const handleDelete = useCallback(() => {
    const visibleSlugs = new Set(allSlugs);
    setArticles((prev) =>
      prev.filter(
        (a) =>
          !(selection.selectedSlugs.has(a.slug) && visibleSlugs.has(a.slug)),
      ),
    );
    selection.clear();
  }, [selection, allSlugs]);

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        No articles yet
      </div>
    );
  }

  const showEmpty =
    paginatedArticles.length === 0 &&
    (search.query.trim() !== "" || filter.hasActiveFilters);

  const emptyMessage =
    search.query.trim() !== "" && filter.hasActiveFilters
      ? "No articles match your search and filters"
      : filter.hasActiveFilters
        ? "No articles match the current filters"
        : "No articles found";

  return (
    <>
      <ArticleToolbar
        isOwner={isOwner}
        selectedCount={selection.count}
        onDelete={handleDelete}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        search={search}
        categories={uniqueCategories}
        filter={filter}
      />
      {showEmpty ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <ArticleListView
          articles={paginatedArticles}
          hasMore={hasMore}
          onLoadMore={loadMore}
          scrollRoot={scrollRoot}
          username={username}
          isOwner={isOwner}
          isAllSelected={selection.isAllSelected}
          isIndeterminate={selection.isIndeterminate}
          onToggleAll={selection.toggleAll}
          isSelected={selection.isSelected}
          onToggle={selection.toggle}
          shouldAnimate={shouldAnimate}
        />
      )}
    </>
  );
}
