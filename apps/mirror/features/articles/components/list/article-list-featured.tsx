"use client";

import { type MouseEvent, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@feel-good/utils/cn";
import { formatShortDate, getContentHref } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { type ArticleSummary } from "../../types";
import { thumbhashToDataUrl } from "../../utils/thumbhash-to-data-url";

type FeaturedVariant = "title-first" | "image-first";

type FeaturedArticleCardProps = {
  article: ArticleSummary;
  username: string;
  variant: FeaturedVariant;
};

function FeaturedArticleCard({
  article,
  username,
  variant,
}: FeaturedArticleCardProps) {
  const { buildChatAwareHref } = useChatSearchParams();
  const { navigateToContent } = useCloneActions();
  const href = buildChatAwareHref(
    getContentHref(username, "articles", article.slug),
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      navigateToContent({ kind: "articles", slug: article.slug });
    },
    [navigateToContent, article.slug],
  );

  const blurDataUrl = thumbhashToDataUrl(article.coverImageThumbhash);
  const imageFirst = variant === "image-first";

  const titleBlock = (
    <div
      className={cn(
        "flex flex-col justify-between @max-[480px]:mb-4",
        imageFirst && "@max-[480px]:order-1",
      )}
    >
      <div className="md:text-3xl @max-[880px]:text-2xl @max-[480px]:text-2xl text-2xl leading-[1.05]">
        {article.title}
      </div>
      <div className="mt-4 @max-[480px]:mt-2 @max-[480px]:leading-[1.3] leading-[1.4] text-sm">
        <div>{article.category}</div>
        {article.publishedAt
          ? (
            <time dateTime={new Date(article.publishedAt).toISOString()}>
              {formatShortDate(article.publishedAt)}
            </time>
          )
          : null}
      </div>
    </div>
  );

  const imageBlock = (
    <div
      className={cn(
        "relative w-full aspect-video h-full bg-gray-5 max-w-[520px] overflow-hidden",
        imageFirst && "@max-[480px]:order-2",
      )}
    >
      {article.coverImageUrl
        ? (
          <Image
            src={article.coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 880px) 100vw, 560px"
            placeholder={blurDataUrl ? "blur" : "empty"}
            blurDataURL={blurDataUrl ?? undefined}
            className="object-cover"
          />
        )
        : null}
    </div>
  );

  return (
    <Link
      href={href}
      scroll={false}
      onClick={handleClick}
      className="block p-4.5 hover:underline"
    >
      <div className="flex flex-row @max-[480px]:flex-col @max-[480px]:gap-0 gap-7 items-start justify-between">
        {imageFirst
          ? (
            <>
              {imageBlock}
              {titleBlock}
            </>
          )
          : (
            <>
              {titleBlock}
              {imageBlock}
            </>
          )}
      </div>
    </Link>
  );
}

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
