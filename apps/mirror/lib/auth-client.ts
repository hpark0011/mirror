"use client";

import { createAppAuthClient, createSessionProvider } from "@feel-good/features/auth";

export const authClient = createAppAuthClient(
  process.env.NEXT_PUBLIC_SITE_URL!
);

const { SessionProvider, useSession } = createSessionProvider(authClient);

export { SessionProvider, useSession };

export const { signIn, signUp, signOut } = authClient;
