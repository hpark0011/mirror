"use client";

import {
  ContentToolbarShell,
  WorkspaceBackButton,
  getContentHref,
} from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { PublishToggleConnector } from "./publish-toggle-connector";
import { type PostSummary } from "../../types";

type PostDetailToolbarProps = {
  username: string;
  post: PostSummary;
};

export function PostDetailToolbar({ username, post }: PostDetailToolbarProps) {
  const { buildChatAwareHref } = useChatSearchParams();
  return (
    <ContentToolbarShell variant="detail">
      <WorkspaceBackButton
        href={buildChatAwareHref(getContentHref(username, "posts"))}
      />
      <PublishToggleConnector post={post} />
    </ContentToolbarShell>
  );
}
