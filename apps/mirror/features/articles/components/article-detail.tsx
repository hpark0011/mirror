"use client";

import dynamic from "next/dynamic";
import { formatLongDate } from "@/features/content";
import type { ArticleWithBody } from "../types";

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
    <div className="py-8 px-4 bg-background min-h-[calc(100vh-40px)]">
      <article className="max-w-xl mx-auto">
        <div className="mb-[56px]">
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[15px] text-muted-foreground leading-[1.2]">
              {article.status === "draft"
                ? "Draft"
                : article.publishedAt
                ? formatLongDate(article.publishedAt)
                : "Draft"}
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
