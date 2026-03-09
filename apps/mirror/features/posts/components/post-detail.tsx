"use client";

import dynamic from "next/dynamic";
import { formatLongDate } from "@/features/content";
import type { PostWithBody } from "../types";

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

type PostDetailProps = {
  post: PostWithBody;
};

export function PostDetail({ post }: PostDetailProps) {
  return (
    <div className="h-full px-4 py-20 flex">
      <article className="mx-auto max-w-3xl flex gap-20">
        <div className="pt-1">
          <div className="flex flex-col items-start gap-0.5 text-nowrap">
            <span className="text-[13px] leading-[1.2] uppercase font-medium">
              {post.status === "draft"
                ? "Draft"
                : formatLongDate(post.publishedAt ?? post.createdAt)}
            </span>
            <span className="text-[14px] font-medium leading-[1.2]">
              {post.category}
            </span>
          </div>
        </div>

        <div className="max-w-lg flex flex-col gap-2">
          <h1 className="max-w-xl text-xl font-regular leading-tight tracking-[-0.02em] underline">
            {post.title}
          </h1>

          <RichTextViewer content={post.body} />
        </div>
      </article>
    </div>
  );
}
