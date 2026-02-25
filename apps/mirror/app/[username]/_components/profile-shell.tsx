"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import type { Profile } from "@/features/profile";
import {
  MobileProfileLayout,
  ProfileInfo,
  ProfileProvider,
} from "@/features/profile";
import type { ProfileActionId } from "@/features/profile";
import {
  ArticleWorkspaceProvider,
  ScrollRootProvider,
} from "@/features/articles";
import type { Article } from "@/features/articles";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";

import { Button } from "@feel-good/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import { Icon } from "@feel-good/ui/components/icon";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import { useProfileNavigationEffects } from "@/hooks/use-profile-navigation-effects";

const VideoCallModal = dynamic(
  () => import("@/features/video-call").then((m) => m.VideoCallModal),
  { ssr: false },
);

type ProfileShellProps = {
  profile: Profile;
  isOwner: boolean;
  articles: Article[];
  children: React.ReactNode;
};

export function ProfileShell(
  { profile, isOwner, articles, children }: ProfileShellProps,
) {
  const isMobile = useIsMobile();
  const [videoCallOpen, setVideoCallOpen] = useState(false);

  const [mobileScrollRoot, setMobileScrollRoot] = useState<
    HTMLDivElement | null
  >(null);
  const [desktopScrollRoot, setDesktopScrollRoot] = useState<
    HTMLDivElement | null
  >(null);

  useProfileNavigationEffects({
    mobile: mobileScrollRoot,
    desktop: desktopScrollRoot,
  });

  const contextValue = useMemo(
    () => ({ isOwner }),
    [isOwner],
  );

  const handleProfileAction = useCallback((id: ProfileActionId) => {
    if (id === "video") {
      setVideoCallOpen(true);
    } else {
      toast("Coming soon", {
        description: `${id.charAt(0).toUpperCase() + id.slice(1)} conversations are not yet available.`,
      });
    }
  }, []);

  return (
    <ProfileProvider value={contextValue}>
      <ArticleWorkspaceProvider articles={articles} username={profile.username}>
        {isMobile
          ? (
            <main className="h-screen">
              <ToolbarSlotProvider>
                <WorkspaceNavbar className="fixed top-0 inset-x-0" />
                <MobileProfileLayout
                  profile={
                    <div className="relative h-full">
                      {isOwner && (
                        <div className="absolute top-0 right-5 z-10">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="default" aria-label="Edit Profile">
                                <Icon name="SquareAndPencilIcon" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Profile</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                      <ProfileInfo profile={profile} onAction={handleProfileAction} />
                    </div>
                  }
                  content={() => (
                    <div className="flex h-full min-h-0 flex-col">
                      <ToolbarSlotTarget />
                      <div className="flex-1 min-h-0 *:h-full">
                        <div
                          ref={setMobileScrollRoot}
                          className="overflow-y-auto overscroll-y-contain h-full px-3"
                        >
                          <ScrollRootProvider value={mobileScrollRoot}>
                            {children}
                          </ScrollRootProvider>
                        </div>
                      </div>
                    </div>
                  )}
                />
              </ToolbarSlotProvider>
            </main>
          )
          : (
            <main className="h-screen">
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
                  <div className="relative z-20 h-full flex flex-col justify-center items-center px-6">
                    {isOwner && (
                      <div className="absolute top-5 right-5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="default" aria-label="Edit Profile">
                              <Icon name="SquareAndPencilIcon" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Profile</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    <ProfileInfo profile={profile} onAction={handleProfileAction} />
                  </div>
                </ResizablePanel>

                <ResizableHandle className="bg-border-subtle data-[resize-handle-state=hover]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] data-[resize-handle-state=drag]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] z-20 relative" />

                <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
                  <ToolbarSlotProvider>
                    <div className="relative h-full min-w-0 flex flex-col">
                      <WorkspaceNavbar />
                      <ToolbarSlotTarget />
                      <div className="flex-1 min-h-0 *:h-full">
                        <div
                          ref={setDesktopScrollRoot}
                          className="overflow-y-auto h-full px-4 pb-[64px]"
                        >
                          {children}
                        </div>
                      </div>
                    </div>
                  </ToolbarSlotProvider>
                </ResizablePanel>
              </ResizablePanelGroup>
            </main>
          )}
      </ArticleWorkspaceProvider>
      {videoCallOpen && (
        <VideoCallModal
          articles={articles}
          onClose={() => setVideoCallOpen(false)}
        />
      )}
    </ProfileProvider>
  );
}
