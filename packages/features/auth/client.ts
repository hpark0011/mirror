"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";

export function createAppAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [convexClient(), magicLinkClient()],
  });
}

export type AuthClient = ReturnType<typeof createAppAuthClient>;
