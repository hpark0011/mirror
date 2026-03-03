"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { Preloaded } from "convex/react";
import type { api } from "@feel-good/convex/convex/_generated/api";
import type { Profile } from "@/features/profile";
import type { Article } from "@/features/articles";
import { ProfileProvider } from "@/features/profile";
import { ArticleWorkspaceProvider } from "@/features/articles";
import { useProfileData } from "@/features/profile/hooks/use-profile-data";

const VideoCallModal = dynamic(
  () => import("@/features/video-call").then((m) => m.VideoCallModal),
  { ssr: false },
);

type ProfileRouteData = {
  profile: Profile;
  articles: Article[];
  isOwner: boolean;
  videoCallOpen: boolean;
  setVideoCallOpen: (open: boolean) => void;
};

const ProfileRouteDataContext = createContext<ProfileRouteData | null>(null);

export function useProfileRouteData() {
  const ctx = useContext(ProfileRouteDataContext);
  if (!ctx) {
    throw new Error(
      "useProfileRouteData must be used within ProfileRouteDataProvider",
    );
  }
  return ctx;
}

type ProfileRouteDataProviderProps = {
  profile: Profile;
  preloadedProfile: Preloaded<typeof api.users.queries.getByUsername>;
  preloadedArticles: Preloaded<typeof api.articles.queries.getByUsername>;
  isOwner: boolean;
  children: ReactNode;
};

export function ProfileRouteDataProvider({
  profile: initialProfile,
  preloadedProfile,
  preloadedArticles,
  isOwner,
  children,
}: ProfileRouteDataProviderProps) {
  const { profile, articles } = useProfileData({
    initialProfile,
    preloadedProfile,
    preloadedArticles,
  });

  const [videoCallOpen, setVideoCallOpen] = useState(false);

  const profileContextValue = useMemo(() => ({ isOwner }), [isOwner]);

  const routeDataValue = useMemo(
    () => ({ profile, articles, isOwner, videoCallOpen, setVideoCallOpen }),
    [profile, articles, isOwner, videoCallOpen],
  );

  return (
    <ProfileRouteDataContext.Provider value={routeDataValue}>
      <ProfileProvider value={profileContextValue}>
        <ArticleWorkspaceProvider
          articles={articles}
          username={profile.username}
        >
          {children}
        </ArticleWorkspaceProvider>
      </ProfileProvider>
      {videoCallOpen && (
        <VideoCallModal
          articles={articles}
          onClose={() => setVideoCallOpen(false)}
        />
      )}
    </ProfileRouteDataContext.Provider>
  );
}
