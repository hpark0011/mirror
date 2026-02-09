import type { Profile } from "../lib/mock-profile";
import { ProfileMedia } from "../components/profile-media";

type ProfileInfoViewProps = {
  profile: Profile;
};

export function ProfileInfoView({ profile }: ProfileInfoViewProps) {
  return (
    <div className="flex flex-col items-center justify-center pb-[80px]">
      {/* Profile Name */}
      <div className="text-3xl font-medium text-center">{profile.name}</div>

      {/* Profile Image */}
      <div className="flex flex-col gap-2 items-center pt-[80px]">
        <ProfileMedia
          video={profile.media.video}
          poster={profile.media.poster}
        />
      </div>

      {/* Profile Bio */}
      <div className="text-lg text-center max-w-md mx-auto mt-[88px] leading-[1.3]">
        {profile.bio}
      </div>
    </div>
  );
}
