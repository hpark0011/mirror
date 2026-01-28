import { createAuthServerUtils } from "@feel-good/features/auth/server";

export const { handler, isAuthenticated, getToken, preloadAuthQuery, fetchAuthQuery } =
  createAuthServerUtils({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
  });
