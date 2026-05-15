"use client";

import Link from "next/link";
import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { type PostSummary } from "../../types";
import { DeletePostConnector } from "../actions/delete-post-connector";

type PostListItemActionsProps = {
  post: PostSummary;
  username: string;
  isOwner: boolean;
};

export function PostListItemActions({
  post,
  username,
  isOwner,
}: PostListItemActionsProps) {
  const { buildChatAwareHref } = useChatSearchParams();

  if (!isOwner) return null;

  return (
    <div
      className="absolute right-4.5 top-4 z-20 hidden items-center gap-1 rounded-[9px] border border-border-subtle bg-background/95 p-1 shadow-sm backdrop-blur group-hover/post-item:flex group-focus-within/post-item:flex"
      data-testid="post-list-actions"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Edit post"
            data-testid="post-list-edit-btn"
          >
            <Link
              href={buildChatAwareHref(`/@${username}/posts/${post.slug}/edit`)}
              scroll={false}
            >
              <Icon name="PencilIcon" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      <DeletePostConnector
        username={username}
        post={post}
        testId="post-list-delete-btn"
      />
    </div>
  );
}
