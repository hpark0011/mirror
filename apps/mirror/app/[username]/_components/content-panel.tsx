"use client";

import { useState, type ReactNode } from "react";
import { ScrollRootProvider } from "@/features/articles";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import {
  ToolbarSlotProvider,
  ToolbarSlotTarget,
} from "@/components/workspace-toolbar-slot";
import {
  useProfileNavigationEffects,
  type RouteMode,
} from "@/hooks/use-profile-navigation-effects";

type ContentPanelProps = {
  routeMode: RouteMode;
  children: ReactNode;
};

export function ContentPanel({ routeMode, children }: ContentPanelProps) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  useProfileNavigationEffects(scrollRoot, routeMode);

  return (
    <ToolbarSlotProvider>
      <div className="relative h-full min-w-0 flex flex-col">
        <WorkspaceNavbar />
        <ToolbarSlotTarget />
        <div className="flex-1 min-h-0 *:h-full relative">
          <div className="w-full absolute top-0 bg-linear-to-b from-background to-transparent max-h-[24px] z-10" />
          <div
            ref={setScrollRoot}
            className="overflow-y-auto h-full pb-[64px] pt-8"
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
