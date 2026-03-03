"use client";

import type { ReactNode } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@feel-good/ui/primitives/resizable";

type DesktopWorkspaceProps = {
  interaction: ReactNode;
  children: ReactNode;
};

export function DesktopWorkspace({
  interaction,
  children,
}: DesktopWorkspaceProps) {
  return (
    <main className="h-screen">
      <ResizablePanelGroup id="profile-workspace" direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
          {interaction}
        </ResizablePanel>

        <ResizableHandle className="bg-border-subtle data-[resize-handle-state=hover]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] data-[resize-handle-state=drag]:shadow-[0_0_0_1px_var(--color-resizable-handle-hover)] z-30 relative" />

        <ResizablePanel defaultSize={50} minSize={25} maxSize={80}>
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
