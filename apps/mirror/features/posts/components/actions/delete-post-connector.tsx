"use client";

import { useIsProfileOwner } from "@/features/profile/context/profile-context";
import { useDeletePost } from "../../hooks/use-delete-post";
import { type PostSummary } from "../../types";
import { DeletePostAction } from "./delete-post-action";

type DeletePostConnectorProps = {
  username: string;
  post: PostSummary;
  testId?: string;
  className?: string;
};

export function DeletePostConnector({
  username,
  post,
  testId,
  className,
}: DeletePostConnectorProps) {
  const isOwner = useIsProfileOwner();
  const remove = useDeletePost({ postId: post._id, username });

  if (!isOwner) return null;

  return (
    <DeletePostAction
      isPending={remove.isPending}
      dialogOpen={remove.dialogOpen}
      onOpenChange={remove.handleOpenChange}
      onConfirm={remove.handleConfirm}
      onCancel={remove.handleCancel}
      testId={testId}
      className={className}
    />
  );
}
