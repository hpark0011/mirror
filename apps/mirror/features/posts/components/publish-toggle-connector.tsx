"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { showToast } from "@feel-good/ui/components/toast";
import { useIsProfileOwner } from "@/features/profile/context/profile-context";
import { PublishToggle } from "./publish-toggle";
import type { PostSummary } from "../types";

type PublishToggleConnectorProps = {
  post: PostSummary;
};

export function PublishToggleConnector({ post }: PublishToggleConnectorProps) {
  const isOwner = useIsProfileOwner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const isSubmittingRef = useRef(false);

  const updatePost = useMutation(api.posts.mutations.update);

  const handleConfirm = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsPending(true);

    const nextStatus = post.status === "draft" ? "published" : "draft";

    try {
      await updatePost({ id: post._id, status: nextStatus });
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
  }, [post._id, post.status, updatePost]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && isSubmittingRef.current) return;
    setDialogOpen(open);
  }, []);

  if (!isOwner) return null;

  return (
    <PublishToggle
      status={post.status}
      isPending={isPending}
      dialogOpen={dialogOpen}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
