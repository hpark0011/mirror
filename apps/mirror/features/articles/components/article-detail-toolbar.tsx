"use client";

import Link from "next/link";
import { Icon } from "@feel-good/ui/components/icon";
import { getContentHref } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";

type ArticleDetailToolbarProps = {
  username: string;
};

export function ArticleDetailToolbar({ username }: ArticleDetailToolbarProps) {
  const { buildChatAwareHref } = useChatSearchParams();

  return (
    <div className="flex h-12 items-center px-3 bg-background">
      <Link
        href={buildChatAwareHref(getContentHref(username, "articles"))}
        scroll={false}
        className="flex items-center gap-0.5 text-[14px] text-muted-foreground hover:text-foreground group"
      >
        <Icon
          name="ArrowLeftCircleFillIcon"
          className="size-6 text-icon group-hover:text-foreground"
        />
        <span className="leading-[1.2]">Back</span>
      </Link>
    </div>
  );
}
