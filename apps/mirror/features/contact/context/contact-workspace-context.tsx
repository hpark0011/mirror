"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type Preloaded } from "convex/react";
import { type api } from "@feel-good/convex/convex/_generated/api";

type PreloadedContactEntries = Preloaded<
  typeof api.contacts.queries.getByUsername
>;

type ContactWorkspaceContextValue = {
  preloadedContactEntries: PreloadedContactEntries;
  username: string;
};

const ContactWorkspaceContext =
  createContext<ContactWorkspaceContextValue | null>(null);

type ContactWorkspaceProviderProps = {
  preloadedContactEntries: PreloadedContactEntries;
  username: string;
  children: ReactNode;
};

export function ContactWorkspaceProvider({
  preloadedContactEntries,
  username,
  children,
}: ContactWorkspaceProviderProps) {
  const value = useMemo(
    () => ({ preloadedContactEntries, username }),
    [preloadedContactEntries, username],
  );
  return (
    <ContactWorkspaceContext.Provider value={value}>
      {children}
    </ContactWorkspaceContext.Provider>
  );
}

export function useContactWorkspace(): ContactWorkspaceContextValue {
  const ctx = useContext(ContactWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useContactWorkspace must be used within a ContactWorkspaceProvider",
    );
  }
  return ctx;
}
