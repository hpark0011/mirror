import React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@feel-good/ui/primitives/avatar";
import { cn } from "@feel-good/utils/cn";
import { getProfileInitials } from "@/features/profile/lib/get-profile-initials";

export function MirrorAvatar({
  className,
  avatarUrl,
  profileName,
  ...props
}: React.ComponentProps<"div"> & {
  avatarUrl: string | null;
  className?: string;
  profileName: string;
}) {
  const initials = getProfileInitials(profileName);

  return (
    <div
      className={cn(
        "relative size-10 rounded-t-full [corner-shape:superellipse(1.15)] bg-black overflow-hidden",
        className,
      )}
      {...props}
    >
      <Avatar className="size-full" {...props}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={profileName} />}
        <AvatarFallback className="text-sm bg-transparent">
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
