"use client";

import type { Article } from "../lib/mock-articles";
import { useArticleList } from "../hooks/use-article-list";
import { ArticleListView } from "../views/article-list-view";

type ScrollableArticleListProps = {
  articles: Article[];
  scrollRoot?: HTMLElement | null;
};

export function ScrollableArticleList({
  articles: allArticles,
  scrollRoot,
}: ScrollableArticleListProps) {
  const { articles, hasMore, loadMore } = useArticleList(allArticles);

  return (
    <ArticleListView
      articles={articles}
      hasMore={hasMore}
      onLoadMore={loadMore}
      scrollRoot={scrollRoot}
    />
  );
}
