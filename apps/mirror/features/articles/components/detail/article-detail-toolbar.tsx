"use client";

import Link from "next/link";
import { Button } from "@feel-good/ui/primitives/button";
import {
  ContentToolbarShell,
  WorkspaceBackButton,
  getContentHref,
} from "@/features/content";
import { useIsProfileOwner } from "@/features/profile";

type ArticleDetailToolbarProps = {
  username: string;
  slug: string;
};

export function ArticleDetailToolbar({
  username,
  slug,
}: ArticleDetailToolbarProps) {
  const isOwner = useIsProfileOwner();

  return (
    <ContentToolbarShell variant="detail">
      <WorkspaceBackButton href={getContentHref(username, "articles")} />
      {isOwner && (
        <Button
          asChild
          variant="primary"
          size="xs"
          className="w-12"
          data-testid="edit-article-btn"
        >
          <Link href={`/@${username}/articles/${slug}/edit`} scroll={false}>
            Edit
          </Link>
        </Button>
      )}
    </ContentToolbarShell>
  );
}
