"use client";

import { getAuthClient, createSessionProvider } from "@feel-good/features/auth";

export const authClient = getAuthClient();

const { SessionProvider, useSession } = createSessionProvider(authClient);

export { SessionProvider, useSession };

export const { signIn, signUp, signOut } = authClient;
