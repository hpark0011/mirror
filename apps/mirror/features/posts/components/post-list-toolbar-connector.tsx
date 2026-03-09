"use client";

import { usePostToolbar } from "../context/post-toolbar-context";
import { PostListToolbar } from "./post-list-toolbar";

export function PostListToolbarConnector() {
  const context = usePostToolbar();

  return (
    <PostListToolbar
      isOwner={context.isOwner}
      sortOrder={context.sortOrder}
      onSortChange={context.onSortChange}
      search={context.search}
      categories={context.categories}
      filter={context.filter}
    />
  );
}
