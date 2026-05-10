import { usePreloadedQuery } from "convex/react";
import { type Preloaded } from "convex/react";
import { type api } from "@feel-good/convex/convex/_generated/api";
import { DEFAULT_PROFILE_SECTION } from "@feel-good/convex/convex/content/href";
import { type Profile } from "../types";

type UseProfileDataArgs = {
  initialProfile: Profile;
  preloadedProfile: Preloaded<typeof api.users.queries.getByUsername>;
};

export function useProfileData({
  initialProfile,
  preloadedProfile,
}: UseProfileDataArgs): {
  profile: Profile;
  chatAuthRequired: boolean;
} {
  const reactiveProfile = usePreloadedQuery(preloadedProfile);
  const profile: Profile = reactiveProfile
    ? {
        _id: reactiveProfile._id,
        authId: reactiveProfile.authId,
        username: reactiveProfile.username ?? initialProfile.username,
        name: reactiveProfile.name ?? "",
        tagline: reactiveProfile.tagline ?? "",
        avatarUrl: reactiveProfile.avatarUrl,
        defaultProfileSection:
          reactiveProfile.defaultProfileSection ??
          initialProfile.defaultProfileSection ??
          DEFAULT_PROFILE_SECTION,
        media: initialProfile.media,
      }
    : initialProfile;

  const chatAuthRequired = reactiveProfile?.chatAuthRequired ?? false;

  return { profile, chatAuthRequired };
}
