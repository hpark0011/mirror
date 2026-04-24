"use client";

import {
  EditActions,
  EditProfileButton,
  ProfileInfo,
} from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { IconButton } from "@feel-good/ui/components/icon-button";
import { SidebarTrigger } from "@feel-good/ui/components/sidebar-trigger";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import { useCallback, useState } from "react";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { useOptionalWorkspaceChrome } from "../_providers/workspace-chrome-context";
import { ProfileLogo } from "./profile-logo";

export function ProfilePanel() {
  const { profile, isOwner, setVideoCallOpen } = useProfileRouteData();
  const { openChat } = useChatSearchParams();
  const chrome = useOptionalWorkspaceChrome();
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditClose = useCallback(() => {
    setIsEditing(false);
    setIsSubmitting(false);
  }, []);

  const editButtonClassName = isMobile
    ? "absolute top-3 right-3 z-10"
    : "absolute top-3 right-3";

  return (
    <div
      className={isMobile
        ? "relative h-full pt-24"
        : "relative z-20 h-full flex flex-col justify-start items-center px-6 py-[132px]"}
    >
      {!isMobile && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-3">
          <ProfileLogo />
          {chrome
            ? (
              <IconButton
                onClick={chrome.toggleInteractionPanel}
                aria-controls={chrome.interactionPanelId}
                aria-expanded={!chrome.isInteractionPanelCollapsed}
                aria-label={chrome.isInteractionPanelCollapsed
                  ? "Expand profile panel"
                  : "Collapse profile panel"}
                tooltip={chrome.isInteractionPanelCollapsed
                  ? "Expand profile panel"
                  : "Collapse profile panel"}
                variant="wrapper"
                className="w-auto"
              >
                <SidebarTrigger isOpen={!chrome.isInteractionPanelCollapsed} />
              </IconButton>
            )
            : null}
        </div>
      )}
      {isOwner && (
        <div className={editButtonClassName}>
          {isEditing
            ? (
              <EditActions
                isEditing={isEditing}
                isSubmitting={isSubmitting}
                onCancel={handleEditClose}
              />
            )
            : <EditProfileButton onClick={() => setIsEditing(true)} />}
        </div>
      )}
      <ProfileInfo
        profile={profile}
        isEditing={isEditing}
        onEditComplete={handleEditClose}
        onSubmittingChange={setIsSubmitting}
        onOpenChat={openChat}
        onOpenVideoCall={() => setVideoCallOpen(true)}
      />
    </div>
  );
}
