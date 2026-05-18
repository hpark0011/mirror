"use client";

import Image from "next/image";
import { PostLayout } from "../post-layout";
import { type PostSummary } from "../../types";

type PostDetailProps = {
  post: PostSummary;
};

export function PostDetail({ post }: PostDetailProps) {
  const cover = post.coverVideoUrl
    ? (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)] mb-3.5">
        <video
          src={post.coverVideoUrl}
          poster={post.coverVideoPosterUrl ?? undefined}
          preload="metadata"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          data-testid="post-detail-cover-video"
        />
      </div>
    )
    : post.coverImageUrl
    ? (
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
    )
    : null;

  return (
    <article className="px-4.5 py-10 flex">
      <PostLayout
        post={post}
        cover={cover}
        title={
          <h1 className="text-xl leading-tight underline capitalize">
            {post.title}
          </h1>
        }
      />
    </article>
  );
}
