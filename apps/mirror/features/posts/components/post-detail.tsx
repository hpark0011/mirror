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
      <article className="mx-auto w-full flex gap-20">
        <div className="pt-1">
          <PostMetadata post={post} />
        </div>

        <div className="w-full flex flex-col items-center">
          <div className="max-w-lg flex flex-col gap-2">
            {post.coverImageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border-subtle bg-background-subtle mb-3">
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
            <h1 className="max-w-xl text-xl font-regular leading-tight tracking-[-0.02em] underline capitalize">
              {post.title}
            </h1>

            <RichTextViewer content={post.body} />
          </div>
        </div>
      </article>
    </div>
  );
}
