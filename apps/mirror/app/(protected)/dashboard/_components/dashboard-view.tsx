"use client";

import type { Article } from "@/features/articles";
import { ScrollableArticleList } from "@/features/articles";
import type { Profile } from "@/features/profile";
import { MobileProfileLayout, ProfileInfoView } from "@/features/profile";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";
import { DashboardHeader } from "./dashboard-header";

type DashboardViewProps = {
  profile: Profile;
  articles: Article[];
};

export function DashboardView(
  { profile, articles }: DashboardViewProps,
) {
  const isMobile = useIsMobile();

  // Mobile layout
  if (isMobile) {
    return (
      <main className="h-screen">
        <DashboardHeader className="fixed top-0 inset-x-0" />
        <MobileProfileLayout
          profile={<ProfileInfoView profile={profile} />}
          content={(scrollRoot) => (
            <div className="px-3">
              <ScrollableArticleList
                articles={articles}
                scrollRoot={scrollRoot}
              />
            </div>
          )}
        />
      </main>
    );
  }

  // Desktop layout
  return (
    <main className="h-screen">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={20} maxSize={50}>
          <div className="relative z-20 h-full flex flex-col justify-center items-center px-6">
            <ProfileInfoView profile={profile} />
          </div>
        </ResizablePanel>

        <ResizableHandle // withHandle
         className="bg-border-subtle data-[resize-handle-state=hover]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] data-[resize-handle-state=drag]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)]" />

        <ResizablePanel defaultSize={50}>
          <div className="relative h-full min-w-0 overflow-y-auto pb-[64px]">
            <DashboardHeader className="sticky top-0" />
            <div className="px-4">
              <ScrollableArticleList articles={articles} />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
