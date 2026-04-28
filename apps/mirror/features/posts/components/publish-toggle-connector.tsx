"use client";

import { useIsProfileOwner } from "@/features/profile/context/profile-context";
import { usePublishToggle } from "../hooks/use-publish-toggle";
import { PublishToggle } from "./publish-toggle";
import type { PostSummary } from "../types";

type PublishToggleConnectorProps = {
  post: PostSummary;
};

export function PublishToggleConnector({ post }: PublishToggleConnectorProps) {
  const isOwner = useIsProfileOwner();
  const toggle = usePublishToggle({ postId: post._id, status: post.status });

  if (!isOwner) return null;

  return (
    <PublishToggle
      status={post.status}
      isPending={toggle.isPending}
      dialogOpen={toggle.dialogOpen}
      onOpenChange={toggle.handleOpenChange}
      onConfirm={toggle.handleConfirm}
      onCancel={toggle.handleCancel}
    />
  );
}
