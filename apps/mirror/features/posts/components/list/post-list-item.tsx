"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { getContentHref } from "@/features/content";
import { PostLayout } from "../post-layout";
import { type PostSummary } from "../../types";

type PostListItemProps = {
  post: PostSummary;
  username: string;
};

// Mirrors `useVisibilityGatedVideoPlayback` in articles/list/article-list-featured-card.tsx.
// IntersectionObserver pauses videos that scroll out of the viewport so a
// long post list with many video covers doesn't churn through decoders.
function useVisibilityGatedVideoPlayback() {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [visibleVideoElement, setVisibleVideoElement] = useState<
    Element | null
  >(null);
  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    setVideoElement(element);
  }, []);

  useEffect(() => {
    if (!videoElement || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisibleVideoElement(entry?.isIntersecting ? entry.target : null);
      },
      { rootMargin: "200px" },
    );

    observer.observe(videoElement);

    return () => {
      observer.disconnect();
    };
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) return;

    if (visibleVideoElement !== videoElement) {
      videoElement.pause();
      return;
    }

    void videoElement.play().catch(() => {
      // Muted-autoplay rejections can still happen on some browsers.
    });
  }, [visibleVideoElement, videoElement]);

  return videoRef;
}

export function PostListItem({ post, username }: PostListItemProps) {
  const { buildChatAwareHref } = useChatSearchParams();
  const { navigateToContent } = useCloneActions();
  const coverVideoRef = useVisibilityGatedVideoPlayback();
  // Keep `<Link href>` populated for SEO/middle-click semantics. The
  // onClick below routes "normal" left-clicks through the same dispatcher
  // the agent uses (`useCloneActions().navigateToContent`).
  const href = buildChatAwareHref(getContentHref(username, "posts", post.slug));

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Preserve middle/cmd/shift-click-to-new-tab semantics.
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      navigateToContent({ kind: "posts", slug: post.slug });
    },
    [navigateToContent, post.slug],
  );

  const cover = post.coverVideoUrl
    ? (
      <Link
        href={href}
        scroll={false}
        onClick={handleClick}
        className="block mb-3.5"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)]">
          <video
            ref={coverVideoRef}
            src={post.coverVideoUrl}
            poster={post.coverVideoPosterUrl ?? undefined}
            preload="metadata"
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            data-testid="post-list-cover-video"
          />
        </div>
      </Link>
    )
    : post.coverImageUrl
    ? (
      <Link
        href={href}
        scroll={false}
        onClick={handleClick}
        className="block mb-3.5"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)]">
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 32rem, 100vw"
            className="object-cover"
          />
        </div>
      </Link>
    )
    : null;

  return (
    <article className="border-b border-border-subtle px-4.5 py-10 last:border-b-0">
      <PostLayout
        post={post}
        capitalizeCategory
        cover={cover}
        title={
          <h2 className="text-xl leading-tight underline decoration-transparent transition-colors hover:text-blue-11">
            <Link href={href} scroll={false} onClick={handleClick}>
              <span className="underline capitalize">{post.title}</span>
            </Link>
          </h2>
        }
      />
    </article>
  );
}
