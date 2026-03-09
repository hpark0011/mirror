"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { Icon } from "@feel-good/ui/components/icon";

import type { Profile } from "../types";
import { ProfileMedia } from "./profile-media";
import { useIsProfileOwner } from "../context/profile-context";

type EditableAvatarProps = {
  isEditing: boolean;
  profile: Profile;
  avatarPreview: string | null;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function AvatarWindow({
  children,
  isEditing,
}: {
  children?: React.ReactNode;
  isEditing: boolean;
}) {
  const controls = useAnimationControls();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

    if (isEditing) {
      // Gray fills top-to-bottom: snap to clipped-from-top, then reveal downward
      controls.set({ clipPath: "inset(100% 0 0 0)" });
      controls.start({ clipPath: "inset(0 0 0 0)", transition: spring });
    } else {
      // Gray recedes upward (black fills bottom-to-top)
      controls.start({ clipPath: "inset(0 0 100% 0)", transition: spring });
    }
  }, [isEditing, controls]);

  return (
    <div className="relative w-[200px] h-[200px] rounded-t-full [corner-shape:superellipse(1.2)] bg-black overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-gray-11"
        animate={controls}
        style={{ clipPath: "inset(100% 0 0 0)" }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function EditableAvatar({
  isEditing,
  profile,
  avatarPreview,
  onAvatarChange,
}: EditableAvatarProps) {
  const isOwner = useIsProfileOwner();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayAvatar = avatarPreview ?? profile.avatarUrl;
  const initial = (profile.name || profile.username || "?")
    .charAt(0)
    .toUpperCase();

  if (isOwner && !profile.media) {
    return (
      <div className="flex flex-col items-center pt-[40px]">
        <AvatarWindow isEditing={isEditing}>
          <AnimatePresence>
            {isEditing && (
              <motion.div
                key="edit-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: 0.1 }}
              >
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative size-[200px] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    data-test="edit-profile-avatar-button"
                  >
                    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground text-4xl">
                      {initial}
                    </div>
                    {displayAvatar
                      ? <ProfileMedia image={displayAvatar} />
                      : null}
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-12 opacity-0 transition-opacity group-hover:opacity-100">
                      <Icon
                        name="PersonFillIcon"
                        className="size-14 text-gray-1"
                      />
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                    className="hidden"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </AvatarWindow>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-[40px]">
      <AnimatePresence mode="popLayout">
        {isEditing
          ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative size-[200px] rounded-t-full [corner-shape:superellipse(1.2)] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-muted"
                  data-test="edit-profile-avatar-button"
                >
                  <div className="flex size-full items-center justify-center bg-muted text-muted-foreground text-4xl">
                    {initial}
                  </div>
                  {displayAvatar
                    ? <ProfileMedia image={displayAvatar} />
                    : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-12 opacity-0 transition-opacity group-hover:opacity-100">
                    <Icon
                      name="PersonFillIcon"
                      className="size-14 text-gray-1"
                    />
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                  className="hidden"
                />
              </div>
            </motion.div>
          )
          : (
            <motion.div
              key="view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {profile.media
                ? (
                  <div className="relative w-[200px] h-[200px] overflow-hidden rounded-t-full [corner-shape:superellipse(1.2)]">
                    <ProfileMedia
                      video={profile.media.video}
                      poster={profile.media.poster}
                    />
                  </div>
                )
                : null}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
