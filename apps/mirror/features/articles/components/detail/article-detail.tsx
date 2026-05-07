"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { formatLongDate } from "@/features/content";
import { type ArticleWithBody } from "../../types";

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
  return (
    <div className="py-12 px-4.5 bg-background min-h-[calc(100vh-40px)]">
      <article className="max-w-xl mx-auto flex flex-col">
        <div className="flex flex-col">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
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
            className={`text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-center mt-3 ${
              article.coverImageUrl ? "mb-7" : "mb-14"
            }`}
          >
            {article.title}
          </h1>
        </div>

        {article.coverImageUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)] mb-14">
            <Image
              src={article.coverImageUrl}
              alt={`Cover image for ${article.title}`}
              fill
              sizes="(min-width: 768px) 36rem, 100vw"
              priority
              className="object-cover"
              data-testid="article-detail-cover-image"
            />
          </div>
        )}

        <RichTextViewer content={article.body} />
      </article>
    </div>
  );
}
