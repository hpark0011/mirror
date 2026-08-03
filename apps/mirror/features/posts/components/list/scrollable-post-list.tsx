"use client";

import { EmptyMessage } from "@/components/empty-message";
import { usePostList } from "../../context/post-list-context";
import { PostListItem } from "./post-list-item";
import { PostListDeleteDialog } from "./post-list-delete-dialog";

export function ScrollablePostList() {
  const context = usePostList();

  if (context.hasNoPosts) {
    return <EmptyMessage showGraphic />;
  }

  if (context.showEmpty) {
    return <EmptyMessage message={context.emptyMessage} />;
  }

  return (
    <PostListDeleteDialog username={context.username}>
      <section className="w-full">
        {context.posts.map((post) => (
          <PostListItem
            key={post.slug}
            post={post}
            username={context.username}
            isOwner={context.isOwner}
          />
        ))}
      </section>
    </PostListDeleteDialog>
  );
}
