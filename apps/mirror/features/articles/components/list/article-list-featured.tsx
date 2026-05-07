"use client";

import { type ArticleSummary } from "../../types";
import { FeaturedArticleCard } from "./article-list-featured-card";

type ArticleListFeaturedProps = {
  articles: ArticleSummary[];
  username: string;
};

export function ArticleListFeatured({
  articles,
  username,
}: ArticleListFeaturedProps) {
  if (articles.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 mb-4">
      {articles.map((article, index) => (
        <FeaturedArticleCard
          key={article.slug}
          article={article}
          username={username}
          variant={index === 0 ? "title-first" : "image-first"}
        />
      ))}
    </div>
  );
}
