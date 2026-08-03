"use client";

import {
  ContentToolbarShell,
  WorkspaceBackButton,
  getContentHref,
} from "@/features/content";
import { DeletePostConnector } from "../actions/delete-post-connector";
import { PublishToggleConnector } from "./publish-toggle-connector";
import { type PostSummary } from "../../types";

type PostDetailToolbarProps = {
  username: string;
  post: PostSummary;
};

export function PostDetailToolbar({ username, post }: PostDetailToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <WorkspaceBackButton href={getContentHref(username, "posts")} />
      <div className="flex items-center gap-2">
        <DeletePostConnector username={username} post={post} />
        <PublishToggleConnector post={post} />
      </div>
    </ContentToolbarShell>
  );
}
