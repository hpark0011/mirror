"use client";

import {
  type ComponentRef,
  type ReactNode,
  type RefCallback,
} from "react";
import { ResizablePanel } from "@feel-good/ui/primitives/resizable";

export const CONTENT_PANEL_ID = "profile-content-panel";
export const INTERACTION_PANEL_ID = "profile-interaction-panel";

type PanelRef = ComponentRef<typeof ResizablePanel>;

type PanelFrameProps = {
  id: string;
  innerId: string;
  testId: string;
  setPanelRef: RefCallback<PanelRef>;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  defaultSize: number;
  children: ReactNode;
};

function PanelFrame({
  id,
  innerId,
  testId,
  setPanelRef,
  isCollapsed,
  onCollapse,
  onExpand,
  defaultSize,
  children,
}: PanelFrameProps) {
  return (
    <ResizablePanel
      id={id}
      ref={setPanelRef}
      defaultSize={defaultSize}
      minSize={25}
      maxSize={100}
      collapsible
      collapsedSize={0}
      className="min-w-0 overflow-hidden"
      onCollapse={onCollapse}
      onExpand={onExpand}
    >
      <div
        id={innerId}
        data-state={isCollapsed ? "closed" : "open"}
        data-testid={testId}
        aria-hidden={isCollapsed}
        inert={isCollapsed}
        className="h-full"
      >
        {children}
      </div>
    </ResizablePanel>
  );
}

type WorkspacePanelProps = {
  setPanelRef: RefCallback<PanelRef>;
  isCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  defaultSize: number;
  children: ReactNode;
};

export function WorkspaceInteractionPanel(props: WorkspacePanelProps) {
  return (
    <PanelFrame
      id="profile-workspace-interaction"
      innerId={INTERACTION_PANEL_ID}
      testId="desktop-interaction-panel"
      {...props}
    />
  );
}

export function WorkspaceContentPanel(props: WorkspacePanelProps) {
  return (
    <PanelFrame
      id="profile-workspace-content"
      innerId={CONTENT_PANEL_ID}
      testId="desktop-content-panel"
      {...props}
    />
  );
}
