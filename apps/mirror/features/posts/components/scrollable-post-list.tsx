"use client";

import { useEffect } from "react";
import { EmptyMessage } from "@/components/empty-message";
import { markContentPanelContentReady } from "@/lib/perf/content-panel-open";
import { usePostList } from "../context/post-list-context";
import { PostListItem } from "./post-list-item";

export function ScrollablePostList() {
  const context = usePostList();

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        markContentPanelContentReady();
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  if (context.hasNoPosts) {
    return <EmptyMessage showGraphic />;
  }

  if (context.showEmpty) {
    return <EmptyMessage message={context.emptyMessage} />;
  }

  return (
    <section className="w-full">
      {context.posts.map((post) => (
        <PostListItem
          key={post.slug}
          post={post}
          username={context.username}
        />
      ))}
    </section>
  );
}
