"use client";

import { useEffect } from "react";
import { EmptyMessage } from "@/components/empty-message";
import { markContentPanelContentReady } from "@/lib/perf/content-panel-open";
import { usePostList } from "../context/post-list-context";
import { PostListItem } from "./post-list-item";

export function ScrollablePostList() {
  const context = usePostList();

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        markContentPanelContentReady();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  if (context.hasNoPosts) {
    return <EmptyMessage showGraphic />;
  }

  if (context.showEmpty) {
    return <EmptyMessage message={context.emptyMessage} />;
  }

  return (
    <section className="w-full pt-6">
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
