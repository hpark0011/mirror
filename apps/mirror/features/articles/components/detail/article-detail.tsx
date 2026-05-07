"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { formatLongDate } from "@/features/content";
import { type ArticleWithBody } from "../../types";
import { thumbhashToDataUrl } from "../../utils/thumbhash-to-data-url";

const RichTextViewer = dynamic(
  () =>
    import("@feel-good/features/editor/components").then(
      (m) => m.RichTextViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="prose dark:prose-invert max-w-none min-h-[200px]" />
    ),
  },
);

type ArticleDetailProps = {
  article: ArticleWithBody;
};

export function ArticleDetail({ article }: ArticleDetailProps) {
  const blurDataUrl = thumbhashToDataUrl(article.coverImageThumbhash);
  return (
    <div className="py-18 px-4.5 bg-background min-h-[calc(100vh-40px)]">
      <article className="mx-auto flex flex-col">
        <div className="flex flex-col gap-0.5 max-w-xl mx-auto w-full">
          <div className="flex items-center justify-start gap-2 text-[14px] font-medium ml-0.5">
            <span className="leading-[1.2]">
              {article.status === "draft"
                ? "Draft"
                : article.publishedAt
                ? formatLongDate(article.publishedAt)
                : "Draft"}
            </span>

            <span>/</span>

            <span className="leading-[1.2]">
              {article.category}
            </span>
          </div>
          <h1
            className={`text-3xl font-medium leading-[1.0] tracking-[-0.04em] text-start ${
              article.coverImageUrl ? "mb-20" : "mb-14"
            }`}
          >
            {article.title}
          </h1>
        </div>

        {article.coverImageUrl && (
          <div
            className="relative left-1/2 -translate-x-1/2 aspect-video overflow-hidden bg-background-subtle [corner-shape:superellipse(1.3)] mb-4 max-w-4xl w-[calc(100%+36px)]"
            data-cover-thumbhash={article.coverImageThumbhash ?? ""}
          >
            <Image
              src={article.coverImageUrl}
              alt={`Cover image for ${article.title}`}
              fill
              priority
              placeholder={blurDataUrl ? "blur" : "empty"}
              blurDataURL={blurDataUrl ?? undefined}
              className="object-cover"
              data-testid="article-detail-cover-image"
            />
          </div>
        )}

        <div className="max-w-xl mx-auto w-full">
          <RichTextViewer content={article.body} />
        </div>
      </article>
    </div>
  );
}
