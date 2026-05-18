"use client";

import { type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@feel-good/ui/primitives/alert-dialog";
import { PostListDeleteContext } from "../../context/post-list-delete-context";
import { useDeletePost } from "../../hooks/use-delete-post";

type PostListDeleteDialogProps = {
  username: string;
  children: ReactNode;
};

/**
 * Mounts a single delete-mutation hook + AlertDialog for the entire post list.
 * Exposes `requestDelete(post)` via PostListDeleteContext so each row's Delete
 * button can trigger the dialog without mounting its own hook tree.
 *
 * Hoisted per FG_233: DeletePostConnector was previously mounted once per row,
 * allocating O(N) hook trees (useMutation + useMemo + 2xsetState + useRef +
 * 3xuseCallback) inside a CSS-hidden container that React still executes.
 */
export function PostListDeleteDialog({
  username,
  children,
}: PostListDeleteDialogProps) {
  const {
    isPending,
    dialogOpen,
    handleOpenChange,
    handleConfirm,
    handleCancel,
    requestDelete,
  } = useDeletePost({ username });

  return (
    <PostListDeleteContext.Provider value={{ requestDelete }}>
      {children}
      <AlertDialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent size="sm" className="data-[size=sm]:max-w-md">
          <AlertDialogHeader className="mx-12 mb-4 mt-3">
            <AlertDialogTitle className="text-lg">Delete post</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this post. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              variant="outline"
              className="dark:bg-dialog"
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PostListDeleteContext.Provider>
  );
}
