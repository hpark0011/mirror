"use client";

import { type MouseEvent, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@feel-good/ui/primitives/tabs";
import { useCloneActions } from "@/app/[username]/_providers/clone-actions-context";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import {
  getProfileTabHref,
  PROFILE_TAB_DISPLAY_ORDER,
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
  const { navigateToProfileSection } = useCloneActions();

  const visibleKinds = PROFILE_TAB_DISPLAY_ORDER.filter(
    (kind) => kind !== "clone-settings" || isOwner,
  );

  // Funnels normal left-clicks through `useCloneActions().navigateToProfileSection`
  // — the same dispatcher the agent uses. cmd/middle/shift-click preserved
  // for open-in-new-tab via the `<Link href>` populated below.
  // Mirrors `post-list-item.tsx`'s click handler.
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, kind: ProfileTabKind) => {
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
      navigateToProfileSection({ section: kind });
    },
    [navigateToProfileSection],
  );

  return (
    <Tabs value={currentKind}>
      <TabsList variant="minimal" className="gap-3">
        {visibleKinds.map((kind) => (
          <div key={kind} className="flex items-center">
            <TabsTrigger
              asChild
              value={kind}
              className="text-[13px]"
            >
              <Link
                href={buildChatAwareHref(getProfileTabHref(username, kind))}
                prefetch={false}
                scroll={false}
                onClick={(event) => handleClick(event, kind)}
                {...(kind === "clone-settings"
                  ? { "data-testid": "profile-tab-clone-settings" }
                  : {})}
              >
                <span className="font-normal">{PROFILE_TAB_LABELS[kind]}</span>
              </Link>
            </TabsTrigger>
          </div>
        ))}
      </TabsList>
    </Tabs>
  );
}
