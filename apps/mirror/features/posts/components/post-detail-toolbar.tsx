"use client";

import Link from "next/link";
import { Icon } from "@feel-good/ui/components/icon";
import { getContentHref } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";

type PostDetailToolbarProps = {
  username: string;
};

export function PostDetailToolbar({ username }: PostDetailToolbarProps) {
  const { buildChatAwareHref } = useChatSearchParams();

  return (
    <div className="flex h-12 items-center bg-background px-3 border-none border-border-subtle">
      <Link
        href={buildChatAwareHref(getContentHref(username, "posts"))}
        scroll={false}
        className="group flex items-center gap-0.5 text-[14px] text-muted-foreground hover:text-foreground"
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
