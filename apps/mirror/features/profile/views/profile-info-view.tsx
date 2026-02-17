import { memo } from "react";
import type { Profile } from "../lib/mock-profile";
import { ProfileMedia } from "../components/profile-media";
import { ProfileActions } from "../components/profile-actions";

type ProfileInfoViewProps = {
  profile: Profile;
  onVideoClick?: () => void;
};

export const ProfileInfoView = memo(function ProfileInfoView({ profile, onVideoClick }: ProfileInfoViewProps) {
  return (
    <div className="flex flex-col items-center justify-center pb-[40px]">
      {/* Profile Name */}
      <div className="text-3xl font-medium text-center">{profile.name}</div>

      {/* Profile Image */}
      <div className="flex flex-col gap-2 items-center pt-[64px]">
        <ProfileMedia
          video={profile.media.video}
          poster={profile.media.poster}
        />
      </div>

      {/* Profile Actions */}
      <div className="mt-[20px]">
        <ProfileActions onVideoClick={onVideoClick} />
      </div>

      {/* Profile Bio */}
      <div className="text-lg text-center max-w-md mx-auto mt-[64px] leading-[1.3]">
        {profile.bio}
      </div>
    </div>
  );
});
