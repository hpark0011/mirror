"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type Preloaded } from "convex/react";
import { type api } from "@feel-good/convex/convex/_generated/api";
import { type Profile } from "@/features/profile";
import { ProfileProvider } from "@/features/profile";
import { useProfileData } from "@/features/profile/hooks/use-profile-data";

type ProfileRouteData = {
  profile: Profile;
  isOwner: boolean;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
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

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profileContextValue = useMemo(() => ({ isOwner }), [isOwner]);

  const routeDataValue = useMemo(
    () => ({
      profile,
      isOwner,
      isEditing,
      setIsEditing,
      isSubmitting,
      setIsSubmitting,
    }),
    [profile, isOwner, isEditing, isSubmitting],
  );

  return (
    <ProfileRouteDataContext.Provider value={routeDataValue}>
      <ProfileProvider value={profileContextValue}>{children}</ProfileProvider>
    </ProfileRouteDataContext.Provider>
  );
}
