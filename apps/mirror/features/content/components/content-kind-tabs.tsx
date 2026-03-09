"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@feel-good/ui/primitives/tabs";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import {
  CONTENT_KIND_LABELS,
  CONTENT_KINDS,
  type ContentKind,
  getContentHref,
} from "../types";

type ContentKindTabsProps = {
  username: string;
  currentKind: ContentKind;
};

export function ContentKindTabs({
  username,
  currentKind,
}: ContentKindTabsProps) {
  const { buildChatAwareHref } = useChatSearchParams();

  return (
    <Tabs value={currentKind}>
      <TabsList variant="folder">
        {CONTENT_KINDS.map((kind) => (
          <TabsTrigger
            asChild
            key={kind}
            value={kind}
            className="group-data-[variant=folder]/tabs-list:before:border-border-subtle h-8"
          >
            <Link
              href={buildChatAwareHref(getContentHref(username, kind))}
              prefetch={false}
              scroll={false}
            >
              {CONTENT_KIND_LABELS[kind]}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
