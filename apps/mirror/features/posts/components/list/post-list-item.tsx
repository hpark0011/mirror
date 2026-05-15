"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ContentBody } from "@feel-good/features/editor/components";
import { cn } from "@feel-good/utils/cn";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { getContentHref } from "@/features/content";
import { PostMetadata } from "../detail/post-metadata";
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
  const shouldAlignWithMetadata = post.title.trim() === "";

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

  return (
    <article className="border-b border-border-subtle px-4.5 py-10 last:border-b-0">
      <div className="flex flex-col md:flex-row  md:items-start md:justify-between gap-5 md:gap-12 w-full items-center justify-center">
        <div className="mt-0.5 md:max-w-22 w-full max-w-lg">
          <PostMetadata post={post} capitalizeCategory />
        </div>
        <div className="flex flex-col items-center w-full">
          <div
            className={cn(
              "max-w-lg flex flex-col w-full",
              shouldAlignWithMetadata ? "gap-1.5" : "gap-2",
            )}
          >
            {post.coverVideoUrl
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
              : null}
            <div className="flex flex-col gap-3">
              <h2 className="text-xl leading-tight underline decoration-transparent transition-colors hover:text-blue-11">
                <Link href={href} scroll={false} onClick={handleClick}>
                  <span className="underline capitalize">
                    {post.title}
                  </span>
                </Link>
              </h2>
            </div>

            <ContentBody
              content={post.body}
              className={cn(
                "max-w-xl text-[17px] leading-[1.3] font-regular space-y-2 [&_img]:my-3 mt-0 tracking-[-0.04em]",
                shouldAlignWithMetadata && "[&>*:first-child]:mt-0",
              )}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
