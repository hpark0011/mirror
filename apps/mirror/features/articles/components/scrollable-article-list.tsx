"use client";

import { EmptyMessage } from "@/components/empty-message";
import { useScrollRoot } from "@/features/content";
import { useArticleList } from "../context/article-list-context";
import { ArticleList } from "./article-list";

export function ScrollableArticleList() {
  const ctx = useArticleList();
  const scrollRoot = useScrollRoot();

  if (ctx.hasNoArticles) {
    return <EmptyMessage showGraphic graphicBottomLabel="Articles" />;
  }

  if (ctx.showEmpty) {
    return <EmptyMessage message={ctx.emptyMessage} />;
  }

  return (
    <ArticleList
      articles={ctx.articles}
      hasMore={ctx.hasMore}
      onLoadMore={ctx.onLoadMore}
      scrollRoot={scrollRoot}
      username={ctx.username}
      isOwner={ctx.isOwner}
      isAllSelected={ctx.isAllSelected}
      isIndeterminate={ctx.isIndeterminate}
      onToggleAll={ctx.onToggleAll}
      isSelected={ctx.isSelected}
      onToggle={ctx.onToggle}
      shouldAnimate={ctx.shouldAnimate}
    />
  );
}
