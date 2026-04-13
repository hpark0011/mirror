"use client";

import { EmptyMessage } from "@/components/empty-message";
import { usePostList } from "../context/post-list-context";
import { PostListItem } from "./post-list-item";

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
