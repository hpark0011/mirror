"use client";

import { useIsProfileOwner } from "@/features/profile/context/profile-context";
import { useDeletePost } from "../../hooks/use-delete-post";
import { type PostSummary } from "../../types";
import { DeletePost } from "./delete-post";

type DeletePostConnectorProps = {
  username: string;
  post: PostSummary;
  testId?: string;
};

export function DeletePostConnector({
  username,
  post,
  testId,
}: DeletePostConnectorProps) {
  const isOwner = useIsProfileOwner();
  const remove = useDeletePost({ postId: post._id, username });

  if (!isOwner) return null;

  return (
    <DeletePost
      isPending={remove.isPending}
      dialogOpen={remove.dialogOpen}
      onOpenChange={remove.handleOpenChange}
      onConfirm={remove.handleConfirm}
      onCancel={remove.handleCancel}
      testId={testId}
    />
  );
}
