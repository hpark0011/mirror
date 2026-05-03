"use client";

import Link from "next/link";
import { Icon } from "@feel-good/ui/components/icon";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { getContentHref, type ContentKind } from "../types";

type ContentBackLinkProps = {
  username: string;
  kind: ContentKind;
};

export function ContentBackLink({ username, kind }: ContentBackLinkProps) {
  const { buildChatAwareHref } = useChatSearchParams();

  return (
    <Link
      href={buildChatAwareHref(getContentHref(username, kind))}
      scroll={false}
      className="group flex items-center gap-[1px] -ml-1 text-[13px] text-muted-foreground hover:text-foreground"
    >
      <Icon
        name="ArrowLeftCircleFillIcon"
        className="size-6 text-icon group-hover:text-foreground"
      />
      <span className="leading-[1.2]">Back</span>
    </Link>
  );
}
