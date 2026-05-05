"use client";

import { useArticleToolbar } from "../context/article-toolbar-context";
import { ArticleListToolbar } from "./article-list-toolbar";

export function ArticleListToolbarConnector() {
  const ctx = useArticleToolbar();
  return (
    <ArticleListToolbar
      isOwner={ctx.isOwner}
      selectedCount={ctx.selectedCount}
      onDelete={ctx.onDelete}
      onNew={ctx.onNew}
      sortOrder={ctx.sortOrder}
      onSortChange={ctx.onSortChange}
      search={ctx.search}
      categories={ctx.categories}
      filter={ctx.filter}
    />
  );
}
