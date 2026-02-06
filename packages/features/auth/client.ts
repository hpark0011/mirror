"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { magicLinkClient, emailOTPClient } from "better-auth/client/plugins";

/**
 * Create an auth client with all plugins.
 * This helper is used to infer the full client type including plugins.
 */
function createFullAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [convexClient(), magicLinkClient(), emailOTPClient()],
  });
}

/**
 * Auth client type including all plugin methods.
 * Inferred from the actual client creation to get proper TypeScript support.
 */
export type AuthClient = ReturnType<typeof createFullAuthClient>;

// Singleton cache for auth clients by URL
const clientCache = new Map<string, AuthClient>();

/**
 * Get or create an auth client for the given base URL.
 * Uses singleton pattern to avoid creating multiple clients for the same URL.
 */
export function getAuthClient(baseURL?: string): AuthClient {
  const url = baseURL ?? process.env.NEXT_PUBLIC_AUTH_URL;

  if (!url) {
    throw new Error(
      "Missing baseURL parameter or NEXT_PUBLIC_AUTH_URL environment variable.\n\n" +
        "Set this in your .env.local file:\n" +
        '  NEXT_PUBLIC_AUTH_URL="http://localhost:3001"'
    );
  }

  // Return cached instance if exists
  if (clientCache.has(url)) {
    return clientCache.get(url)!;
  }

  const client = createFullAuthClient(url);
  clientCache.set(url, client);
  return client;
}