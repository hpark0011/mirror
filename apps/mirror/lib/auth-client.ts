"use client";

import { createAppAuthClient, createUseSession } from "@feel-good/features/auth";

export const authClient = createAppAuthClient(
  process.env.NEXT_PUBLIC_SITE_URL!
);

export const useSession = createUseSession(authClient);

export const { signIn, signUp, signOut } = authClient;
