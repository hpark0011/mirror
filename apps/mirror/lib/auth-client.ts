"use client";

import { createAppAuthClient, createSessionProvider } from "@feel-good/features/auth";
import { clientEnv } from "./env/client";

export const authClient = createAppAuthClient(
  clientEnv.NEXT_PUBLIC_SITE_URL
);

const { SessionProvider, useSession } = createSessionProvider(authClient);

export { SessionProvider, useSession };

export const { signIn, signUp, signOut } = authClient;
