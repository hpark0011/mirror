"use client";

import { createContext, useContext } from "react";

type ProfileContextValue = {
  isOwner: boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider = ProfileContext.Provider;

export function useIsProfileOwner() {
  const context = useContext(ProfileContext);
  if (!context)
    throw new Error("useIsProfileOwner must be used within ProfileProvider");
  return context.isOwner;
}
