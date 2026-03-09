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
import { ProfileProvider } from "@/features/profile";
import { useProfileData } from "@/features/profile/hooks/use-profile-data";

const VideoCallModal = dynamic(
  () => import("@/features/video-call").then((m) => m.VideoCallModal),
  { ssr: false },
);

type ProfileRouteData = {
  profile: Profile;
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
  isOwner: boolean;
  children: ReactNode;
};

export function ProfileRouteDataProvider({
  profile: initialProfile,
  preloadedProfile,
  isOwner,
  children,
}: ProfileRouteDataProviderProps) {
  const { profile } = useProfileData({
    initialProfile,
    preloadedProfile,
  });

  const [videoCallOpen, setVideoCallOpen] = useState(false);

  const profileContextValue = useMemo(() => ({ isOwner }), [isOwner]);

  const routeDataValue = useMemo(
    () => ({ profile, isOwner, videoCallOpen, setVideoCallOpen }),
    [profile, isOwner, videoCallOpen],
  );

  return (
    <ProfileRouteDataContext.Provider value={routeDataValue}>
      <ProfileProvider value={profileContextValue}>{children}</ProfileProvider>
      {videoCallOpen && (
        <VideoCallModal
          username={profile.username}
          onClose={() => setVideoCallOpen(false)}
        />
      )}
    </ProfileRouteDataContext.Provider>
  );
}
