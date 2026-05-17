"use client";

import { createContext, useContext } from "react";
import { type PostSummary } from "../types";

export type PostListDeleteContextValue = {
  /** Open the list-level delete confirmation dialog for the given post. */
  requestDelete: (post: PostSummary) => void;
};

export const PostListDeleteContext =
  createContext<PostListDeleteContextValue | null>(null);

/**
 * Returns the list-level delete callback, or null when called outside the
 * post list (e.g. post detail). Callers that need the callback must check
 * for null themselves.
 */
export function usePostListDelete(): PostListDeleteContextValue | null {
  return useContext(PostListDeleteContext);
}
