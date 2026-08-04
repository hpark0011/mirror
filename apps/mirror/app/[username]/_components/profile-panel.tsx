"use client";

import {
  EditActions,
  EditProfileButton,
  ProfileInfo,
} from "@/features/profile";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useCallback } from "react";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { ProfileLogo } from "./profile-logo";

export function ProfilePanel() {
  const {
    profile,
    isOwner,
    isEditing,
    setIsEditing,
    isSubmitting,
    setIsSubmitting,
  } = useProfileRouteData();
  const { openChat } = useChatSearchParams();
  const handleEditClose = useCallback(() => {
    setIsEditing(false);
    setIsSubmitting(false);
  }, [setIsEditing, setIsSubmitting]);

  // This dormant surface retains host-provided padding variables so it can be
  // embedded in a future profile experience without owning outer chrome.
  return (
    <div className="relative h-full pt-[var(--workspace-content-top-pad)] pb-[var(--workspace-content-bottom-pad)] md:z-20 md:flex md:flex-col md:justify-start md:items-center md:px-6">
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-3">
        <ProfileLogo />
      </div>

      <div className="md:hidden absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {isOwner && isEditing ? (
          <EditActions
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            onCancel={handleEditClose}
          />
        ) : isOwner ? (
          <EditProfileButton onClick={() => setIsEditing(true)} />
        ) : null}
      </div>

      <ProfileInfo
        profile={profile}
        isEditing={isEditing}
        onEditComplete={handleEditClose}
        onSubmittingChange={setIsSubmitting}
        onOpenChat={openChat}
      />
    </div>
  );
}
