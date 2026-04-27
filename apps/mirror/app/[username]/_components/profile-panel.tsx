"use client";

import {
  EditActions,
  EditProfileButton,
  ProfileInfo,
} from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { XmarkIcon } from "@feel-good/icons";
import { IconButton } from "@feel-good/ui/components/icon-button";
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

  return (
    <div
      className={isMobile
        ? "relative h-full pt-24"
        : "relative z-20 h-full flex flex-col justify-start items-center px-6 py-[132px]"}
    >
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-3">
        <ProfileLogo />
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {isOwner &&
            isEditing
          ? (
            <EditActions
              isEditing={isEditing}
              isSubmitting={isSubmitting}
              onCancel={handleEditClose}
            />
          )
          : <EditProfileButton onClick={() => setIsEditing(true)} />}
        {!isMobile && (
          <IconButton
            onClick={chrome?.toggleInteractionPanel}
            aria-controls={chrome?.interactionPanelId}
            aria-expanded={chrome
              ? !chrome.isInteractionPanelCollapsed
              : undefined}
            aria-label="Close profile panel"
            tooltip="Close Profile"
            className="rounded-full"
            size="icon"
          >
            <XmarkIcon className="size-4.5 text-icon" />
          </IconButton>
        )}
      </div>

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
