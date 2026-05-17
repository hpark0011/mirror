"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { showToast } from "@feel-good/ui/components/toast";
import { getMutationErrorMessage } from "@/lib/get-mutation-error-message";
import { type PostSummary } from "../types";

export type UseListDeletePostReturn = {
  dialogOpen: boolean;
  isPending: boolean;
  handleConfirm: () => Promise<void>;
  handleCancel: () => void;
  handleOpenChange: (open: boolean) => void;
  requestDelete: (post: PostSummary) => void;
};

/**
 * List-level variant of useDeletePost.
 *
 * Mounts a single useMutation + withOptimisticUpdate + dialog-state tree for
 * the entire post list. Each row calls `requestDelete(post)` to open the
 * confirmation dialog for that specific post.
 *
 * FG_233: this replaces the per-row DeletePostConnector mount (O(N) hook
 * trees) with a single hook tree at the list level.
 */
export function useListDeletePost(username: string): UseListDeletePostReturn {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const isSubmittingRef = useRef(false);
  // Ref so handleConfirm always reads the current target without being a dep.
  const targetPostRef = useRef<PostSummary | null>(null);

  const removeMutation = useMutation(api.posts.mutations.remove);

  const removePosts = useMemo(
    () =>
      removeMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.posts.queries.getByUsername, {
          username,
        });
        if (current == null) return;
        store.setQuery(
          api.posts.queries.getByUsername,
          { username },
          current.filter((post) => !args.ids.includes(post._id)),
        );
      }),
    [removeMutation, username],
  );

  const requestDelete = useCallback((post: PostSummary) => {
    targetPostRef.current = post;
    setDialogOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    const postId = targetPostRef.current?._id;
    if (isSubmittingRef.current || postId == null) return;
    isSubmittingRef.current = true;
    setIsPending(true);

    try {
      // List-page caller: already at the target URL — no router.replace needed.
      // The optimistic update removes the row immediately; navigation would
      // re-trigger an SSR preload of pre-delete state and flash the row back.
      await removePosts({ ids: [postId] });
      showToast({ type: "success", title: "Post deleted" });
      setDialogOpen(false);
      targetPostRef.current = null;
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    } finally {
      isSubmittingRef.current = false;
      setIsPending(false);
    }
  }, [removePosts]);

  const handleCancel = useCallback(() => {
    if (isSubmittingRef.current) return;
    setDialogOpen(false);
    targetPostRef.current = null;
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && isSubmittingRef.current) return;
    setDialogOpen(open);
    if (!open) {
      targetPostRef.current = null;
    }
  }, []);

  return {
    dialogOpen,
    isPending,
    handleConfirm,
    handleCancel,
    handleOpenChange,
    requestDelete,
  };
}
