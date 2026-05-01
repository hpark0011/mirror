"use client";

import { ContentBackLink, ContentToolbarShell } from "@/features/content";

type ArticleDetailToolbarProps = {
  username: string;
};

export function ArticleDetailToolbar({ username }: ArticleDetailToolbarProps) {
  return (
    <ContentToolbarShell>
      <ContentBackLink username={username} kind="articles" />
    </ContentToolbarShell>
  );
}
