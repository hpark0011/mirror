"use client";

import { useIsProfileOwner } from "@/features/profile/context/profile-context";
import { useDeletePost } from "../../hooks/use-delete-post";
import { DeletePostButton } from "./delete-post-button";
import { type PostSummary } from "../../types";

type DeletePostConnectorProps = {
  username: string;
  post: PostSummary;
};

export function DeletePostConnector({
  username,
  post,
}: DeletePostConnectorProps) {
  const isOwner = useIsProfileOwner();
  const remove = useDeletePost({ postId: post._id, username });

  if (!isOwner) return null;

  return (
    <DeletePostButton
      isPending={remove.isPending}
      dialogOpen={remove.dialogOpen}
      onOpenChange={remove.handleOpenChange}
      onConfirm={remove.handleConfirm}
      onCancel={remove.handleCancel}
    />
  );
}
