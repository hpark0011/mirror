import { type ArticleSummary } from "../types";

/**
 * Returns the most recently published articles, sorted by `publishedAt` DESC.
 *
 * Filters out drafts and any published row missing `publishedAt`. Both filter
 * clauses matter: removing the status check would surface drafts in the public
 * featured slot, and removing the `publishedAt !== undefined` check would let
 * undated rows tie at `0` and leak in front of legitimately recent articles.
 */
export function getLatestPublishedArticles(
  articles: ArticleSummary[],
  count = 2,
): ArticleSummary[] {
  return articles
    .filter((a) => a.status === "published" && a.publishedAt !== undefined)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, count);
}
