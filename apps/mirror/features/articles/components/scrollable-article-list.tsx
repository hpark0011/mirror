"use client";

import { useArticleList } from "../context/article-list-context";
import { useScrollRoot } from "../context/scroll-root-context";
import { ArticleListView } from "../views/article-list-view";

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      {message}
    </div>
  );
}

export function ScrollableArticleList() {
  const ctx = useArticleList();
  const scrollRoot = useScrollRoot();

  if (ctx.hasNoArticles) {
    return <EmptyMessage message="No articles yet" />;
  }

  if (ctx.showEmpty) {
    return <EmptyMessage message={ctx.emptyMessage} />;
  }

  return (
    <ArticleListView
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
