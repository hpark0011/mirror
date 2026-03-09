"use client";

import { useMemo, type ReactNode } from "react";
import { usePreloadedQuery } from "convex/react";
import type { Preloaded } from "convex/react";
import type { api } from "@feel-good/convex/convex/_generated/api";
import { useIsProfileOwner } from "@/features/profile";
import type { PostSummary } from "../types";
import { usePostFilter } from "../hooks/use-post-filter";
import { usePostSearch } from "../hooks/use-post-search";
import { usePostSort } from "../hooks/use-post-sort";
import {
  filterPosts,
  getUniquePostCategories,
  sortPosts,
} from "../utils/post-filter";
import { PostListContext } from "./post-list-context";
import { PostToolbarContext } from "./post-toolbar-context";

type PostWorkspaceProviderProps = {
  preloadedPosts: Preloaded<typeof api.posts.queries.getByUsername>;
  username: string;
  children: ReactNode;
};

export function PostWorkspaceProvider({
  preloadedPosts,
  username,
  children,
}: PostWorkspaceProviderProps) {
  const reactivePosts = usePreloadedQuery(preloadedPosts);
  const isOwner = useIsProfileOwner();
  const posts = useMemo(
    () => ((reactivePosts ?? []) as PostSummary[]),
    [reactivePosts],
  );
  const search = usePostSearch(posts);
  const { sortOrder, setSortOrder } = usePostSort();
  const filter = usePostFilter();
  const filteredPosts = useMemo(
    () => filterPosts(search.filteredPosts, filter.filterState, isOwner),
    [search.filteredPosts, filter.filterState, isOwner],
  );
  const visiblePosts = useMemo(
    () => sortPosts(filteredPosts, sortOrder, search.isFiltered),
    [filteredPosts, sortOrder, search.isFiltered],
  );
  const categories = useMemo(() => getUniquePostCategories(posts), [posts]);
  const hasNoPosts = posts.length === 0;
  const showEmpty =
    visiblePosts.length === 0 &&
    (search.query.trim() !== "" || filter.hasActiveFilters);
  const emptyMessage =
    search.query.trim() !== "" && filter.hasActiveFilters
      ? "No posts match your search and filters"
      : filter.hasActiveFilters
        ? "No posts match the current filters"
        : "No posts found";

  const toolbarValue = useMemo(
    () => ({
      isOwner,
      sortOrder,
      onSortChange: setSortOrder,
      search,
      filter,
      categories,
    }),
    [isOwner, sortOrder, setSortOrder, search, filter, categories],
  );

  const listValue = useMemo(
    () => ({
      posts: visiblePosts,
      username,
      isOwner,
      hasNoPosts,
      showEmpty,
      emptyMessage,
    }),
    [visiblePosts, username, isOwner, hasNoPosts, showEmpty, emptyMessage],
  );

  return (
    <PostToolbarContext.Provider value={toolbarValue}>
      <PostListContext.Provider value={listValue}>
        {children}
      </PostListContext.Provider>
    </PostToolbarContext.Provider>
  );
}
