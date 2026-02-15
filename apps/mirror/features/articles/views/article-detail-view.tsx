"use client";

import dynamic from "next/dynamic";
import { formatLongDate } from "../lib/format-date";
import type { Article } from "../lib/mock-articles";

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

type ArticleDetailViewProps = {
  article: Article;
};

export function ArticleDetailView({ article }: ArticleDetailViewProps) {
  return (
    <div className="py-22 px-4 bg-background min-h-[calc(100vh-40px)]">
      <article className="max-w-xl mx-auto">
        <div className="mb-[56px]">
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[15px] text-muted-foreground leading-[1.2]">
              {article.status === "draft" ? "Draft" : formatLongDate(article.published_at)}
            </span>

            <span className="text-[15px] font-medium text-muted-foreground leading-[1.2]">
              {article.category}
            </span>
          </div>
          <h1 className="text-3xl font-medium mt-[48px] leading-tight tracking-[-0.02em] text-center">
            {article.title}
          </h1>
        </div>

        <RichTextViewer content={article.body} />
      </article>
    </div>
  );
}
