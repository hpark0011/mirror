"use client";

import { type ReactNode, useState } from "react";
import { ScrollRootProvider, type ContentRouteState } from "@/features/content";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import { useProfileNavigationEffects } from "@/hooks/use-profile-navigation-effects";

type ContentPanelProps = {
  routeState: ContentRouteState;
  children: ReactNode;
};

export function ContentPanel({ routeState, children }: ContentPanelProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  useProfileNavigationEffects(scrollRoot, routeState);

  return (
    <ToolbarSlotProvider>
      <div className="relative h-full min-w-0 flex flex-col">
        <WorkspaceNavbar />
        <ToolbarSlotTarget />
        <div className="flex-1 min-h-0 *:h-full relative">
          <div className="w-full absolute top-0 bg-linear-to-b to-transparent max-h-[40px] z-10 from-background" />
          <div
            ref={setScrollRoot}
            className="overflow-y-auto h-full pb-[64px] pt-0"
          >
            <ScrollRootProvider value={scrollRoot}>
              {children}
            </ScrollRootProvider>
          </div>
        </div>
      </div>
    </ToolbarSlotProvider>
  );
}
