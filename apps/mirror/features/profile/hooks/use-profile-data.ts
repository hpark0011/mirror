import { usePreloadedQuery } from "convex/react";
import type { Preloaded } from "convex/react";
import type { api } from "@feel-good/convex/convex/_generated/api";
import type { Profile } from "../types";

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
      bio: reactiveProfile.bio ?? "",
      avatarUrl: reactiveProfile.avatarUrl,
      media: initialProfile.media,
    }
    : initialProfile;

  const chatAuthRequired = reactiveProfile?.chatAuthRequired ?? false;

  return { profile, chatAuthRequired };
}
