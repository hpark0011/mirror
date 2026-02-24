import { memo } from "react";
import type { Profile } from "../lib/mock-profile";
import type { ProfileActionId } from "../components/profile-actions";
import { ProfileMedia } from "../components/profile-media";
import { ProfileActions } from "../components/profile-actions";

type ProfileInfoProps = {
  profile: Profile;
  onAction?: (id: ProfileActionId) => void;
};

export const ProfileInfo = memo(function ProfileInfo({ profile, onAction }: ProfileInfoProps) {
  return (
    <div className="flex flex-col items-center justify-center pb-[40px]">
      <div className="text-3xl font-medium text-center">{profile.name}</div>
      <div className="flex flex-col gap-2 items-center pt-[64px]">
        {profile.media && (
          <ProfileMedia video={profile.media.video} poster={profile.media.poster} />
        )}
      </div>
      <div className="mt-[20px]">
        <ProfileActions onAction={onAction} />
      </div>
      <div className="text-lg text-center max-w-md mx-auto mt-[64px] leading-[1.3]">
        {profile.bio}
      </div>
    </div>
  );
});
