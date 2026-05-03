"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
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
    <div className="px-4.5 py-10 flex">
      <article className="flex flex-col md:flex-row  md:items-start md:justify-between gap-5 md:gap-12 w-full items-center justify-center">
        <div className="mt-0.5 md:max-w-22 w-full max-w-lg">
          <PostMetadata post={post} />
        </div>

        <div className="w-full flex flex-col items-center">
          <div className="max-w-lg flex flex-col gap-2 w-full">
            {post.coverImageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)] mb-3.5">
                <Image
                  src={post.coverImageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 32rem, 100vw"
                  priority
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex flex-col gap-3">
              <h1 className="text-xl leading-tight underline capitalize">
                {post.title}
              </h1>
            </div>

            <RichTextViewer
              content={post.body}
              className="max-w-xl text-[17px] leading-[1.3] font-regular space-y-2 [&_img]:my-3 mt-0"
            />
          </div>
        </div>
      </article>
    </div>
  );
}
