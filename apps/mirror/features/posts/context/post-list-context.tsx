"use client";

import { createContext, useContext } from "react";
import type { PostSummary } from "../types";

export type PostListContextValue = {
  posts: PostSummary[];
  username: string;
  isOwner: boolean;
  hasNoPosts: boolean;
  showEmpty: boolean;
  emptyMessage: string;
};

export const PostListContext = createContext<PostListContextValue | null>(null);

export function usePostList() {
  const context = useContext(PostListContext);
  if (!context) {
    throw new Error("usePostList must be used within PostWorkspaceProvider");
  }

  return context;
}
