import type { DatePreset } from "@/features/content";
import { getDateRange } from "@/features/content";
import type { SortOrder } from "../hooks/use-post-sort";
import type { PostSummary } from "../types";

export type PostFilterState = {
  categories: string[];
  publishedDatePreset: DatePreset | null;
  createdDatePreset: DatePreset | null;
  publishedStatus: "draft" | "published" | null;
};

export const INITIAL_POST_FILTER_STATE: PostFilterState = {
  categories: [],
  publishedDatePreset: null,
  createdDatePreset: null,
  publishedStatus: null,
};

export function filterPosts(
  posts: PostSummary[],
  filter: PostFilterState,
  isOwner: boolean,
): PostSummary[] {
  const publishedDateRange =
    filter.publishedDatePreset !== null
      ? (() => {
          const range = getDateRange(filter.publishedDatePreset);
          return {
            start: range.start.getTime(),
            end: range.end.getTime(),
          };
        })()
      : null;

  const createdDateRange =
    isOwner && filter.createdDatePreset !== null
      ? (() => {
          const range = getDateRange(filter.createdDatePreset);
          return {
            start: range.start.getTime(),
            end: range.end.getTime(),
          };
        })()
      : null;

  return posts.filter((post) => {
    if (
      filter.categories.length > 0 &&
      !filter.categories.includes(post.category)
    ) {
      return false;
    }

    if (publishedDateRange !== null) {
      const publishedTimestamp = post.publishedAt ?? 0;

      if (
        publishedTimestamp < publishedDateRange.start ||
        publishedTimestamp > publishedDateRange.end
      ) {
        return false;
      }
    }

    if (createdDateRange !== null) {
      if (
        post.createdAt < createdDateRange.start ||
        post.createdAt > createdDateRange.end
      ) {
        return false;
      }
    }

    if (
      isOwner &&
      filter.publishedStatus !== null &&
      post.status !== filter.publishedStatus
    ) {
      return false;
    }

    return true;
  });
}

export function getUniquePostCategories(
  posts: PostSummary[],
): { name: string; count: number }[] {
  if (posts.length === 0) {
    return [];
  }

  const categoryMap = new Map<string, number>();

  posts.forEach((post) => {
    const currentCount = categoryMap.get(post.category) || 0;
    categoryMap.set(post.category, currentCount + 1);
  });

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function sortPosts(
  posts: PostSummary[],
  sortOrder: SortOrder,
  preserveOrder = false,
): PostSummary[] {
  if (preserveOrder) {
    return posts;
  }

  return [...posts].sort((left, right) => {
    const diff = (right.publishedAt ?? 0) - (left.publishedAt ?? 0);
    return sortOrder === "newest" ? diff : -diff;
  });
}
