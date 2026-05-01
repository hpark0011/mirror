"use client";

import { ContentBackLink, ContentToolbarShell } from "@/features/content";
import { PublishToggleConnector } from "./publish-toggle-connector";
import type { PostSummary } from "../types";

type PostDetailToolbarProps = {
  username: string;
  post: PostSummary;
};

export function PostDetailToolbar({ username, post }: PostDetailToolbarProps) {
  return (
    <ContentToolbarShell>
      <ContentBackLink username={username} kind="posts" />
      <PublishToggleConnector post={post} />
    </ContentToolbarShell>
  );
}
