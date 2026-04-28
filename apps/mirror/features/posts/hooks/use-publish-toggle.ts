"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { showToast } from "@feel-good/ui/components/toast";
import type { PostSummary } from "../types";

export type UsePublishToggleArgs = {
  postId: PostSummary["_id"];
  status: PostSummary["status"];
};

export type UsePublishToggleReturn = {
  dialogOpen: boolean;
  isPending: boolean;
  handleConfirm: () => Promise<void>;
  handleCancel: () => void;
  handleOpenChange: (open: boolean) => void;
};

export function usePublishToggle({
  postId,
  status,
}: UsePublishToggleArgs): UsePublishToggleReturn {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const isSubmittingRef = useRef(false);

  const updatePost = useMutation(api.posts.mutations.update);

  const handleConfirm = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsPending(true);

    const nextStatus = status === "draft" ? "published" : "draft";

    try {
      await updatePost({ id: postId, status: nextStatus });
      showToast({
        type: "success",
        title:
          nextStatus === "published" ? "Post published" : "Post moved to drafts",
      });
      setDialogOpen(false);
    } catch (err) {
      showToast({
        type: "error",
        title:
          err instanceof Error ? err.message : "Something went wrong. Try again.",
      });
      // Dialog stays open so the user can retry — do NOT close here.
    } finally {
      isSubmittingRef.current = false;
      setIsPending(false);
    }
  }, [postId, status, updatePost]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && isSubmittingRef.current) return;
    setDialogOpen(open);
  }, []);

  return {
    dialogOpen,
    isPending,
    handleConfirm,
    handleCancel,
    handleOpenChange,
  };
}
