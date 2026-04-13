"use client";

import dynamic from "next/dynamic";
import { PostMetadata } from "./post-metadata";
import type { PostSummary } from "../types";

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
  post: PostSummary;
};

export function PostDetail({ post }: PostDetailProps) {
  return (
    <div className="h-full px-4.5 py-8 flex">
      <article className="mx-auto w-full flex gap-20">
        <div className="pt-1">
          <PostMetadata post={post} />
        </div>

        <div className="w-full flex flex-col items-center">
          <div className="max-w-lg flex flex-col gap-2">
            <h1 className="max-w-xl text-xl font-regular leading-tight tracking-[-0.02em] underline">
              {post.title}
            </h1>

            <RichTextViewer content={post.body} />
          </div>
        </div>
      </article>
    </div>
  );
}
