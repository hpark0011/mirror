"use client";

import { type MouseEvent, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { getContentEditHref } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { usePostListDelete } from "../../context/post-list-delete-context";
import { type PostSummary } from "../../types";

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
  const { navigateToEditor } = useCloneActions();
  const listDelete = usePostListDelete();

  // Keep `<Link href>` populated for SEO/middle-click semantics. The
  // onClick below routes "normal" left-clicks through the same dispatcher
  // the agent uses (`useCloneActions().navigateToEditor`), mirroring the
  // pattern used by `PostListItem` for `navigateToContent`.
  const editHref = buildChatAwareHref(
    getContentEditHref(username, "posts", post.slug),
  );

  const handleEditClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // Preserve middle/cmd/shift-click-to-new-tab semantics.
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      event.preventDefault();
      navigateToEditor({ kind: "posts", slug: post.slug });
    },
    [navigateToEditor, post.slug],
  );

  // UI-only gate. The real authorization boundaries are server-side:
  //   - api.posts.mutations.remove (deletePostForUserById → isOwnedByUser)
  //   - app/[username]/@content/posts/[slug]/edit/page.tsx (server-component owner check + redirect)
  // Removing one of those gates is what would actually allow cross-user actions; this `null` return is cosmetic.
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
            <Link href={editHref} scroll={false} onClick={handleEditClick}>
              <Icon name="PencilIcon" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>
      {listDelete != null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete post"
              data-testid="post-list-delete-btn"
              onClick={() => listDelete.requestDelete(post)}
            >
              <Icon name="TrashFillIcon" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
