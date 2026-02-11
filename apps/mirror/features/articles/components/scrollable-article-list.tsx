"use client";

import { useState, useCallback, useMemo } from "react";
import type { Article } from "../lib/mock-articles";
import { useArticleList } from "../hooks/use-article-list";
import { useArticleSelection } from "../hooks/use-article-selection";
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
  const { articles: paginatedArticles, hasMore, loadMore } = useArticleList(articles);
  const isOwner = useIsProfileOwner();
  const scrollRoot = useScrollRoot();

  const allSlugs = useMemo(
    () => paginatedArticles.map((a) => a.slug),
    [paginatedArticles],
  );

  const selection = useArticleSelection(allSlugs);

  const handleDelete = useCallback(() => {
    setArticles((prev) =>
      prev.filter((a) => !selection.selectedSlugs.has(a.slug)),
    );
    selection.clear();
  }, [selection]);

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        No articles yet
      </div>
    );
  }

  return (
    <>
      {isOwner && (
        <ArticleToolbar
          selectedCount={selection.count}
          onDelete={handleDelete}
        />
      )}
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
      />
    </>
  );
}
