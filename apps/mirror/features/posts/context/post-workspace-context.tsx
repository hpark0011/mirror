"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { usePreloadedQuery } from "convex/react";
import { type Preloaded } from "convex/react";
import { useRouter } from "next/navigation";
import { type api } from "@feel-good/convex/convex/_generated/api";
import { useIsProfileOwner } from "@/features/profile";
import {
  filterContent,
  getUniqueContentCategories,
  sortContent,
  useContentSearch,
  useContentSort,
} from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { type PostSummary } from "../types";
import { usePostFilter } from "../hooks/use-post-filter";
import { PostListContext } from "./post-list-context";
import { PostToolbarContext } from "./post-toolbar-context";

const getPostSearchableFields = (post: PostSummary) => [
  post.title,
  post.category,
];

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
  const router = useRouter();
  const reactivePosts = usePreloadedQuery(preloadedPosts);
  const isOwner = useIsProfileOwner();
  const { buildChatAwareHref } = useChatSearchParams();
  const posts = useMemo(
    () => ((reactivePosts ?? []) as PostSummary[]),
    [reactivePosts],
  );
  const search = useContentSearch(posts, getPostSearchableFields);
  const { sortOrder, setSortOrder } = useContentSort();
  const filter = usePostFilter();
  const filteredPosts = useMemo(
    () => filterContent(search.filteredItems, filter.filterState, isOwner),
    [search.filteredItems, filter.filterState, isOwner],
  );
  const visiblePosts = useMemo(
    () => sortContent(filteredPosts, sortOrder, search.isFiltered),
    [filteredPosts, sortOrder, search.isFiltered],
  );
  const categories = useMemo(
    () => getUniqueContentCategories(posts),
    [posts],
  );
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

  const handleNew = useCallback(() => {
    router.push(`/@${username}/posts/new`);
  }, [router, username]);

  const toolbarValue = useMemo(
    () => ({
      isOwner,
      sortOrder,
      onSortChange: setSortOrder,
      search,
      filter,
      categories,
      onNew: handleNew,
    }),
    [
      isOwner,
      sortOrder,
      setSortOrder,
      search,
      filter,
      categories,
      handleNew,
    ],
  );

  const listValue = useMemo(
    () => ({
      posts: visiblePosts,
      username,
      isOwner,
      hasNoPosts,
      showEmpty,
      emptyMessage,
      buildChatAwareHref,
    }),
    [visiblePosts, username, isOwner, hasNoPosts, showEmpty, emptyMessage, buildChatAwareHref],
  );

  return (
    <PostToolbarContext.Provider value={toolbarValue}>
      <PostListContext.Provider value={listValue}>
        {children}
      </PostListContext.Provider>
    </PostToolbarContext.Provider>
  );
}
