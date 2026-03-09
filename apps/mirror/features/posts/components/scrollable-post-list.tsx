"use client";

import { HeptagonalPrism } from "@/components/animated-geometries/heptagonal-prism";
import { usePostList } from "../context/post-list-context";
import { PostListItem } from "./post-list-item";

function EmptyMessage({
  message,
  showGraphic = false,
}: {
  message?: string;
  showGraphic?: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 pb-16 text-muted-foreground">
      {showGraphic && <HeptagonalPrism />}
      <p>{message}</p>
    </div>
  );
}

export function ScrollablePostList() {
  const context = usePostList();

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
