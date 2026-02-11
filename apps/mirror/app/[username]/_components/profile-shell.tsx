"use client";

import { useState, ViewTransition } from "react";
import type { Profile } from "@/features/profile";
import { MobileProfileLayout, ProfileInfoView } from "@/features/profile";
import { ScrollRootProvider } from "@/features/articles";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { ProfileHeader } from "./profile-header";
import { useNavDirection } from "@/hooks/use-nav-direction";

type ProfileShellProps = {
  profile: Profile;
  children: React.ReactNode;
};

export function ProfileShell({ profile, children }: ProfileShellProps) {
  const { username } = profile;
  const isMobile = useIsMobile();
  const { isArticleDetail } = useNavDirection();

  const [mobileScrollRoot, setMobileScrollRoot] = useState<
    HTMLDivElement | null
  >(null);

  if (isMobile) {
    return (
      <main className="h-screen">
        <ProfileHeader
          username={username}
          isArticleDetail={isArticleDetail}
          className="fixed top-0 inset-x-0"
        />
        <MobileProfileLayout
          profile={<ProfileInfoView profile={profile} />}
          content={() => (
            <ViewTransition name="profile-content">
              <div
                ref={setMobileScrollRoot}
                className="overflow-y-auto overscroll-y-contain h-full px-3"
              >
                <ScrollRootProvider value={mobileScrollRoot}>
                  {children}
                </ScrollRootProvider>
              </div>
            </ViewTransition>
          )}
        />
      </main>
    );
  }

  return (
    <main className="h-screen">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
          <div className="relative z-20 h-full flex flex-col justify-center items-center px-6">
            <ProfileInfoView profile={profile} />
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-border-subtle data-[resize-handle-state=hover]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] data-[resize-handle-state=drag]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)]" />

        <ResizablePanel defaultSize={50} minSize={40} maxSize={80}>
          <div className="relative h-full min-w-0 flex flex-col">
            <ProfileHeader username={username} isArticleDetail={isArticleDetail} />
            <div className="flex-1 min-h-0 *:h-full">
              <ViewTransition name="profile-content">
                <div className="overflow-y-auto h-full px-4 pb-[64px]">
                  {children}
                </div>
              </ViewTransition>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
