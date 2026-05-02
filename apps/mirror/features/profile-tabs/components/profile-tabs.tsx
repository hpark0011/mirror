"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@feel-good/ui/primitives/tabs";
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

  const visibleKinds = PROFILE_TAB_DISPLAY_ORDER.filter(
    (kind) => kind !== "clone-settings" || isOwner,
  );

  return (
    <Tabs value={currentKind}>
      <TabsList variant="minimal" className="">
        {visibleKinds.map((kind, index) => (
          <div key={kind} className="flex items-center">
            <TabsTrigger asChild value={kind} className="text-[13px]">
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
            {index < visibleKinds.length - 1 && (
              <span className="text-transparent mx-1.5 font-normal">/</span>
            )}
          </div>
        ))}
      </TabsList>
    </Tabs>
  );
}
