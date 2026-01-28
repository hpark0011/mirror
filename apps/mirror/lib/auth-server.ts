import { createAuthServerUtils } from "@feel-good/features/auth/server";
import { serverEnv } from "./env/server";

export const { handler, isAuthenticated, getToken, preloadAuthQuery, fetchAuthQuery } =
  createAuthServerUtils({
    convexUrl: serverEnv.NEXT_PUBLIC_CONVEX_URL,
    convexSiteUrl: serverEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
  });
