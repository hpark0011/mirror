"use client";

import { useEffect, useRef } from "react";

type ArticleListLoaderProps = {
  hasMore: boolean;
  onLoadMore: () => void;
  scrollRoot?: HTMLElement | null;
};

export function ArticleListLoader({
  hasMore,
  onLoadMore,
  scrollRoot,
}: ArticleListLoaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        rootMargin: "200px",
        root: scrollRoot ?? null,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, onLoadMore, scrollRoot]);

  if (!hasMore) return null;

  return (
    <div ref={sentinelRef} className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
    </div>
  );
}
