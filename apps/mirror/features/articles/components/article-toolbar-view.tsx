"use client";

import { useArticleToolbar } from "../context/article-toolbar-context";
import { ArticleToolbar } from "../components/article-toolbar";

export function ArticleToolbarView() {
  const ctx = useArticleToolbar();
  return (
    <ArticleToolbar
      isOwner={ctx.isOwner}
      selectedCount={ctx.selectedCount}
      onDelete={ctx.onDelete}
      sortOrder={ctx.sortOrder}
      onSortChange={ctx.onSortChange}
      search={ctx.search}
      categories={ctx.categories}
      filter={ctx.filter}
    />
  );
}
