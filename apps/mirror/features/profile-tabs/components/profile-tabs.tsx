"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@feel-good/ui/primitives/tabs";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import {
  getProfileTabHref,
  PROFILE_TAB_KINDS,
  PROFILE_TAB_LABELS,
  type ProfileTabKind,
} from "../types";

type ProfileTabsProps = {
  username: string;
  currentKind: ProfileTabKind;
  isOwner: boolean;
};

export function ProfileTabs({
  username,
  currentKind,
  isOwner,
}: ProfileTabsProps) {
  const { buildChatAwareHref } = useChatSearchParams();

  const visibleKinds = PROFILE_TAB_KINDS.filter(
    (kind) => kind !== "clone-settings" || isOwner,
  );

  return (
    <Tabs value={currentKind}>
      <TabsList variant="folder">
        {visibleKinds.map((kind) => (
          <TabsTrigger
            asChild
            key={kind}
            value={kind}
            className="group-data-[variant=folder]/tabs-list:before:border-border-subtle h-8"
          >
            <Link
              href={buildChatAwareHref(getProfileTabHref(username, kind))}
              prefetch={false}
              scroll={false}
              {...(kind === "clone-settings"
                ? { "data-testid": "profile-tab-clone-settings" }
                : {})}
            >
              {PROFILE_TAB_LABELS[kind]}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
