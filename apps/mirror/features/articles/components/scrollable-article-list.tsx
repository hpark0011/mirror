"use client";

import type { Article } from "../lib/mock-articles";
import { useArticleList } from "../hooks/use-article-list";
import { ArticleListView } from "../views/article-list-view";
import { useScrollRoot } from "../context/scroll-root-context";

type ScrollableArticleListProps = {
  articles: Article[];
  username: string;
};

export function ScrollableArticleList({
  articles: allArticles,
  username,
}: ScrollableArticleListProps) {
  const { articles, hasMore, loadMore } = useArticleList(allArticles);
  const scrollRoot = useScrollRoot();

  return (
    <ArticleListView
      articles={articles}
      hasMore={hasMore}
      onLoadMore={loadMore}
      scrollRoot={scrollRoot}
      username={username}
    />
  );
}
