"use client";

import { createContext, useContext } from "react";
import type {
  SortOrder,
  UseContentSearchReturn,
} from "@/features/content";
import type { PostSummary } from "../types";
import type { UsePostFilterReturn } from "../hooks/use-post-filter";

export type PostToolbarContextValue = {
  isOwner: boolean;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  search: UseContentSearchReturn<PostSummary>;
  filter: UsePostFilterReturn;
  categories: { name: string; count: number }[];
  isUploadDialogOpen: boolean;
  onOpenUploadDialog: () => void;
  onCloseUploadDialog: () => void;
};

export const PostToolbarContext =
  createContext<PostToolbarContextValue | null>(null);

export function usePostToolbar() {
  const context = useContext(PostToolbarContext);
  if (!context) {
    throw new Error(
      "usePostToolbar must be used within PostWorkspaceProvider",
    );
  }

  return context;
}
