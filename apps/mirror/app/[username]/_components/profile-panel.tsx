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

  const editButtonClassName = isMobile
    ? "absolute top-0 right-5 z-10"
    : "absolute top-3 right-3";

  return (
    <div
      className={isMobile
        ? "relative h-full"
        : "relative z-20 h-full flex flex-col justify-start items-center px-6 py-[132px]"}
    >
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
      {!isMobile && (
        <div className="absolute left-3 top-3 z-100">
          <ProfileLogo />
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
