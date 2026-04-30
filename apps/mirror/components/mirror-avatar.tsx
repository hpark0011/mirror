import React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@feel-good/ui/primitives/avatar";
import { cn } from "@feel-good/utils/cn";
import { getProfileInitials } from "@/features/profile/lib/get-profile-initials";

type MirrorAvatarShape = "tombstone" | "circle";

const SHAPE_CLASSNAME: Record<MirrorAvatarShape, string> = {
  tombstone: "rounded-t-full",
  circle: "rounded-full",
};

export function MirrorAvatar({
  className,
  avatarUrl,
  profileName,
  shape = "tombstone",
  ...props
}: React.ComponentProps<"div"> & {
  avatarUrl: string | null;
  className?: string;
  profileName: string;
  shape?: MirrorAvatarShape;
}) {
  const initials = getProfileInitials(profileName);

  return (
    <div
      className={cn(
        "relative size-10 [corner-shape:superellipse(1.15)] bg-black overflow-hidden",
        SHAPE_CLASSNAME[shape],
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
