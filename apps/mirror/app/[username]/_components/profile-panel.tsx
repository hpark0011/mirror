"use client";

import {
  EditActions,
  EditProfileButton,
  ProfileInfo,
} from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import { useCallback, useState } from "react";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { ProfileLogo } from "./profile-logo";

export function ProfilePanel() {
  const { profile, isOwner, setVideoCallOpen } = useProfileRouteData();
  const { openChat } = useChatSearchParams();
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

      {/* Offset to leave room for the chrome's close-profile button at right-3 (see WorkspaceInteractionPanel) */}
      <div className="absolute top-3 right-14 z-10 flex items-center gap-1.5">
        {isOwner && isEditing
          ? (
            <EditActions
              isEditing={isEditing}
              isSubmitting={isSubmitting}
              onCancel={handleEditClose}
            />
          )
          : <EditProfileButton onClick={() => setIsEditing(true)} />}
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
