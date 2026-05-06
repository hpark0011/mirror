"use client";

import Link from "next/link";
import { Button } from "@feel-good/ui/primitives/button";
import {
  ContentToolbarShell,
  WorkspaceBackButton,
  getContentHref,
} from "@/features/content";
import { useIsProfileOwner } from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";

type ArticleDetailToolbarProps = {
  username: string;
  slug: string;
};

export function ArticleDetailToolbar({ username, slug }: ArticleDetailToolbarProps) {
  const isOwner = useIsProfileOwner();
  const { buildChatAwareHref } = useChatSearchParams();

  return (
    <ContentToolbarShell variant="detail">
      <WorkspaceBackButton
        href={buildChatAwareHref(getContentHref(username, "articles"))}
      />
      {isOwner && (
        <Button
          asChild
          variant="primary"
          size="xs"
          className="w-12"
          data-testid="edit-article-btn"
        >
          <Link
            href={buildChatAwareHref(`/@${username}/articles/${slug}/edit`)}
            scroll={false}
          >
            Edit
          </Link>
        </Button>
      )}
    </ContentToolbarShell>
  );
}
