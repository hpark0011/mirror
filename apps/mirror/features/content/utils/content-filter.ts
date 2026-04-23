import type { DatePreset } from "./date-preset";
import { getDateRange } from "./date-preset";
import type { SortOrder } from "../hooks/use-content-sort";

/**
 * Shared filter state used by every content list (articles, posts, …).
 *
 * The shape is intentionally structural — `content/` does not know about
 * any particular feature's document type.
 */
export type ContentFilterState = {
  categories: string[];
  publishedDatePreset: DatePreset | null;
  createdDatePreset: DatePreset | null;
  publishedStatus: "draft" | "published" | null;
};

export const INITIAL_CONTENT_FILTER_STATE: ContentFilterState = {
  categories: [],
  publishedDatePreset: null,
  createdDatePreset: null,
  publishedStatus: null,
};

/**
 * Structural shape every filterable content item must satisfy. Articles and
 * posts both already happen to expose these fields — the interface is defined
 * here in `content/` and is not derived from any feature type.
 */
export interface FilterableContent {
  category: string;
  publishedAt?: number;
  createdAt: number;
  status: "draft" | "published";
}

export function filterContent<T extends FilterableContent>(
  items: T[],
  filter: ContentFilterState,
  isOwner: boolean,
): T[] {
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

  return items.filter((item) => {
    if (
      filter.categories.length > 0 &&
      !filter.categories.includes(item.category)
    ) {
      return false;
    }

    if (publishedDateRange !== null) {
      const publishedTimestamp = item.publishedAt ?? 0;

      if (
        publishedTimestamp < publishedDateRange.start ||
        publishedTimestamp > publishedDateRange.end
      ) {
        return false;
      }
    }

    if (createdDateRange !== null) {
      if (
        item.createdAt < createdDateRange.start ||
        item.createdAt > createdDateRange.end
      ) {
        return false;
      }
    }

    if (
      isOwner &&
      filter.publishedStatus !== null &&
      item.status !== filter.publishedStatus
    ) {
      return false;
    }

    return true;
  });
}

export function getUniqueContentCategories<T extends { category: string }>(
  items: T[],
): { name: string; count: number }[] {
  if (items.length === 0) {
    return [];
  }

  const categoryMap = new Map<string, number>();

  items.forEach((item) => {
    const currentCount = categoryMap.get(item.category) ?? 0;
    categoryMap.set(item.category, currentCount + 1);
  });

  return Array.from(categoryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Structural shape required for chronological sort. Anything with an optional
 * `publishedAt` timestamp is sortable.
 */
export interface SortableContent {
  publishedAt?: number;
}

export function sortContent<T extends SortableContent>(
  items: T[],
  sortOrder: SortOrder,
  preserveOrder = false,
): T[] {
  if (preserveOrder) {
    return items;
  }

  return [...items].sort((left, right) => {
    const diff = (right.publishedAt ?? 0) - (left.publishedAt ?? 0);
    return sortOrder === "newest" ? diff : -diff;
  });
}
