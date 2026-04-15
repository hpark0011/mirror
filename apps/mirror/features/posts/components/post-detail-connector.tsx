"use client";

import { usePreloadedQuery, type Preloaded } from "convex/react";
import type { api } from "@feel-good/convex/convex/_generated/api";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { PostDetail } from "./post-detail";
import { PostDetailToolbar } from "./post-detail-toolbar";
import type { PostSummary } from "../types";

type PostDetailConnectorProps = {
  preloadedPost: Preloaded<typeof api.posts.queries.getBySlug>;
  username: string;
};

export function PostDetailConnector({
  preloadedPost,
  username,
}: PostDetailConnectorProps) {
  const post = usePreloadedQuery(preloadedPost);

  // post becomes null if it disappears (e.g. owner unpublishes then navigates away)
  if (!post) return null;

  return (
    <>
      <WorkspaceToolbar>
        <PostDetailToolbar username={username} post={post as PostSummary} />
      </WorkspaceToolbar>
      <PostDetail post={post as PostSummary} />
    </>
  );
}
