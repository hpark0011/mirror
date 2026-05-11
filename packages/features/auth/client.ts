"use client";

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { magicLinkClient, emailOTPClient } from "better-auth/client/plugins";

/**
 * Create an auth client with all plugins.
 * This helper is used to infer the full client type including plugins.
 */
function createFullAuthClient(baseURL?: string) {
  return createAuthClient({
    ...(baseURL ? { baseURL } : {}),
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
const SAME_ORIGIN_AUTH_KEY = "__same_origin_auth__";

/**
 * Get or create an auth client for the given base URL.
 * Omitting a base URL uses Better Auth's same-origin `/api/auth` default,
 * which keeps Vercel previews on their unique deployment host.
 */
export function getAuthClient(baseURL?: string): AuthClient {
  const url = baseURL ?? process.env.NEXT_PUBLIC_AUTH_URL;
  const cacheKey = url ?? SAME_ORIGIN_AUTH_KEY;

  // Return cached instance if exists
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const client = createFullAuthClient(url);
  clientCache.set(cacheKey, client);
  return client;
}
