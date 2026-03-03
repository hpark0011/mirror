"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EditActions,
  EditProfileButton,
  ProfileInfo,
} from "@/features/profile";
import { useIsMobile } from "@feel-good/ui/hooks/use-mobile";
import { useProfileRouteData } from "../_providers/profile-route-data-context";

export function ProfilePanel() {
  const { profile, isOwner, setVideoCallOpen } = useProfileRouteData();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditClose = useCallback(() => {
    setIsEditing(false);
    setIsSubmitting(false);
  }, []);

  const editButtonClassName = isMobile
    ? "absolute top-0 right-5 z-10"
    : "absolute top-4 right-4";

  return (
    <div
      className={
        isMobile
          ? "relative h-full"
          : "relative z-20 h-full flex flex-col justify-start items-center px-6 pt-[88px]"
      }
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
            : (
              <EditProfileButton onClick={() => setIsEditing(true)} />
            )}
        </div>
      )}
      <ProfileInfo
        profile={profile}
        isEditing={isEditing}
        onEditComplete={handleEditClose}
        onSubmittingChange={setIsSubmitting}
        onOpenChat={() => router.push(`/@${profile.username}/chat`)}
        onOpenVideoCall={() => setVideoCallOpen(true)}
      />
    </div>
  );
}
