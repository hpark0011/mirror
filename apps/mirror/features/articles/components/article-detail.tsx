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
    <div className="py-12 px-4 bg-background min-h-[calc(100vh-40px)]">
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
          <h1 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-center mt-8 mb-6">
            {article.title}
          </h1>
        </div>

        <RichTextViewer content={article.body} />
      </article>
    </div>
  );
}
