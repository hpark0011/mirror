"use client";

import {
  useCallback,
  type ComponentRef,
  type ReactNode,
  type RefCallback,
} from "react";
import { ResizablePanel } from "@feel-good/ui/primitives/resizable";
import { XmarkIcon } from "@feel-good/icons";
import { IconButton } from "@feel-good/ui/components/icon-button";
import { EditActions, EditProfileButton } from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useOptionalWorkspaceChrome } from "../_providers/workspace-chrome-context";
import { useProfileRouteData } from "../_providers/profile-route-data-context";

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
  const { children, ...rest } = props;
  const chrome = useOptionalWorkspaceChrome();
  const { isOwner, isEditing, isSubmitting, setIsEditing, setIsSubmitting } =
    useProfileRouteData();
  const { isChatOpen } = useChatSearchParams();
  const showCloseButton =
    chrome?.canCollapseInteractionPanel &&
    !chrome.isInteractionPanelCollapsed;

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setIsSubmitting(false);
  }, [setIsEditing, setIsSubmitting]);

  return (
    <PanelFrame
      id="profile-workspace-interaction"
      innerId={INTERACTION_PANEL_ID}
      testId="desktop-interaction-panel"
      {...rest}
    >
      <div className="relative h-full">
        {children}
        {!isChatOpen && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
            {isOwner && isEditing
              ? (
                <EditActions
                  isEditing={isEditing}
                  isSubmitting={isSubmitting}
                  onCancel={handleEditCancel}
                />
              )
              : isOwner
              ? <EditProfileButton onClick={() => setIsEditing(true)} />
              : null}
            {showCloseButton && (
              <IconButton
                onClick={chrome.toggleInteractionPanel}
                aria-controls={INTERACTION_PANEL_ID}
                aria-expanded={!chrome.isInteractionPanelCollapsed}
                aria-label="Close profile panel"
                tooltip="Close Profile"
                className="rounded-full"
                size="icon"
              >
                <XmarkIcon className="size-4.5 text-icon" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </PanelFrame>
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
