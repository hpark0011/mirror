import type { ArticleSummary } from "../types";
import type { DatePreset } from "./date-preset";
import { getDateRange } from "./date-preset";

export type ArticleFilterState = {
  categories: string[];
  publishedDatePreset: DatePreset | null;
  createdDatePreset: DatePreset | null;
  publishedStatus: "draft" | "published" | null;
};

export const INITIAL_FILTER_STATE: ArticleFilterState = {
  categories: [],
  publishedDatePreset: null,
  createdDatePreset: null,
  publishedStatus: null,
};

export function filterArticles(
  articles: ArticleSummary[],
  filter: ArticleFilterState,
  isOwner: boolean
): ArticleSummary[] {
  // Compute date ranges once outside the filter loop
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

  return articles.filter((article) => {
    // Category filter (AND logic with others)
    if (filter.categories.length > 0) {
      if (!filter.categories.includes(article.category)) {
        return false;
      }
    }

    // Published date filter (AND logic with others)
    if (publishedDateRange !== null) {
      const publishedTimestamp = article.publishedAt ?? 0;

      if (
        publishedTimestamp < publishedDateRange.start ||
        publishedTimestamp > publishedDateRange.end
      ) {
        return false;
      }
    }

    // Created date filter (only applies if isOwner and filter is active)
    if (createdDateRange !== null) {
      const createdTimestamp = article.createdAt;

      if (
        createdTimestamp < createdDateRange.start ||
        createdTimestamp > createdDateRange.end
      ) {
        return false;
      }
    }

    // Published status filter (only applies if isOwner and filter is active)
    if (isOwner && filter.publishedStatus !== null) {
      if (article.status !== filter.publishedStatus) {
        return false;
      }
    }

    return true;
  });
}

export function getUniqueCategories(
  articles: ArticleSummary[]
): { name: string; count: number }[] {
  if (articles.length === 0) {
    return [];
  }

  const categoryMap = new Map<string, number>();

  articles.forEach((article) => {
    const currentCount = categoryMap.get(article.category) || 0;
    categoryMap.set(article.category, currentCount + 1);
  });

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
