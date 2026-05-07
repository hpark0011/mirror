// Pins the featured-list derivation contract:
//   - drafts are excluded (would leak unpublished work onto public profile)
//   - published rows with publishedAt === undefined are excluded (tie at 0
//     would race in front of legitimately recent articles)
//   - results are sorted by publishedAt DESC
//   - slice respects the count parameter (default 2)
import { describe, expect, it } from "vitest";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type ArticleSummary } from "../../types";
import { getLatestPublishedArticles } from "../get-latest-published-articles";

function makeArticle(overrides: Partial<ArticleSummary>): ArticleSummary {
  return {
    _id: "art_default" as Id<"articles">,
    _creationTime: 0,
    userId: "user_default" as Id<"users">,
    slug: "default-slug",
    title: "Default Title",
    coverImageUrl: null,
    coverImageThumbhash: null,
    createdAt: 0,
    status: "published",
    category: "general",
    ...overrides,
  };
}

describe("getLatestPublishedArticles", () => {
  it("returns [] for an empty input", () => {
    expect(getLatestPublishedArticles([])).toEqual([]);
  });

  it("returns [] when every article is a draft", () => {
    const drafts = [
      makeArticle({ slug: "d1", status: "draft", publishedAt: undefined }),
      makeArticle({ slug: "d2", status: "draft", publishedAt: 1000 }),
    ];
    expect(getLatestPublishedArticles(drafts)).toEqual([]);
  });

  it("excludes drafts even when published rows are present", () => {
    const articles = [
      makeArticle({ slug: "draft", status: "draft", publishedAt: 5000 }),
      makeArticle({ slug: "pub", status: "published", publishedAt: 1000 }),
    ];
    const result = getLatestPublishedArticles(articles);
    expect(result.map((a) => a.slug)).toEqual(["pub"]);
  });

  it("excludes a published article whose publishedAt is undefined", () => {
    const articles = [
      makeArticle({
        slug: "no-date",
        status: "published",
        publishedAt: undefined,
      }),
      makeArticle({ slug: "dated", status: "published", publishedAt: 2000 }),
    ];
    const result = getLatestPublishedArticles(articles);
    expect(result.map((a) => a.slug)).toEqual(["dated"]);
  });

  it("returns at most `count` items by default (count=2)", () => {
    const articles = [
      makeArticle({ slug: "a", publishedAt: 1000 }),
      makeArticle({ slug: "b", publishedAt: 2000 }),
      makeArticle({ slug: "c", publishedAt: 3000 }),
      makeArticle({ slug: "d", publishedAt: 4000 }),
    ];
    const result = getLatestPublishedArticles(articles);
    expect(result).toHaveLength(2);
  });

  it("orders results by publishedAt descending", () => {
    const articles = [
      makeArticle({ slug: "oldest", publishedAt: 1000 }),
      makeArticle({ slug: "newest", publishedAt: 4000 }),
      makeArticle({ slug: "middle", publishedAt: 2500 }),
    ];
    const result = getLatestPublishedArticles(articles, 3);
    expect(result.map((a) => a.slug)).toEqual(["newest", "middle", "oldest"]);
  });

  it("returns fewer than `count` when fewer published articles exist", () => {
    const articles = [
      makeArticle({ slug: "only", publishedAt: 1000 }),
      makeArticle({ slug: "draft", status: "draft", publishedAt: 5000 }),
    ];
    const result = getLatestPublishedArticles(articles, 2);
    expect(result.map((a) => a.slug)).toEqual(["only"]);
  });

  it("respects a custom `count` parameter", () => {
    const articles = [
      makeArticle({ slug: "a", publishedAt: 1000 }),
      makeArticle({ slug: "b", publishedAt: 2000 }),
      makeArticle({ slug: "c", publishedAt: 3000 }),
    ];
    expect(getLatestPublishedArticles(articles, 1)).toHaveLength(1);
    expect(getLatestPublishedArticles(articles, 3)).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const articles = [
      makeArticle({ slug: "a", publishedAt: 1000 }),
      makeArticle({ slug: "b", publishedAt: 3000 }),
      makeArticle({ slug: "c", publishedAt: 2000 }),
    ];
    const snapshot = articles.map((a) => a.slug);
    getLatestPublishedArticles(articles);
    expect(articles.map((a) => a.slug)).toEqual(snapshot);
  });
});
