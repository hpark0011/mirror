"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type Preloaded } from "convex/react";
import { type api } from "@feel-good/convex/convex/_generated/api";

type PreloadedBioEntries = Preloaded<typeof api.bio.queries.getByUsername>;

type BioWorkspaceContextValue = {
  preloadedBioEntries: PreloadedBioEntries;
  username: string;
};

const BioWorkspaceContext = createContext<BioWorkspaceContextValue | null>(
  null,
);

type BioWorkspaceProviderProps = {
  preloadedBioEntries: PreloadedBioEntries;
  username: string;
  children: ReactNode;
};

export function BioWorkspaceProvider({
  preloadedBioEntries,
  username,
  children,
}: BioWorkspaceProviderProps) {
  const value = useMemo(
    () => ({ preloadedBioEntries, username }),
    [preloadedBioEntries, username],
  );
  return (
    <BioWorkspaceContext.Provider value={value}>
      {children}
    </BioWorkspaceContext.Provider>
  );
}

export function useBioWorkspace(): BioWorkspaceContextValue {
  const ctx = useContext(BioWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useBioWorkspace must be used within a BioWorkspaceProvider",
    );
  }
  return ctx;
}
