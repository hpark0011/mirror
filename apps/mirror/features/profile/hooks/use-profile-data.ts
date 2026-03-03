import { usePreloadedQuery } from "convex/react";
import type { Preloaded } from "convex/react";
import type { api } from "@feel-good/convex/convex/_generated/api";
import type { Profile } from "../types";
import type { Article } from "@/features/articles/types";

type UseProfileDataArgs = {
  initialProfile: Profile;
  preloadedProfile: Preloaded<typeof api.users.queries.getByUsername>;
  preloadedArticles: Preloaded<typeof api.articles.queries.getByUsername>;
};

export function useProfileData({
  initialProfile,
  preloadedProfile,
  preloadedArticles,
}: UseProfileDataArgs): {
  profile: Profile;
  articles: Article[];
  chatAuthRequired: boolean;
} {
  const reactiveProfile = usePreloadedQuery(preloadedProfile);
  const reactiveArticles = usePreloadedQuery(preloadedArticles);

  const articles: Article[] = (reactiveArticles ?? []) as Article[];
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

  return { profile, articles, chatAuthRequired };
}
