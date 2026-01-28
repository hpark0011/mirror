import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

export interface AuthServerConfig {
  convexUrl: string;
  convexSiteUrl: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createAuthServerUtils(config: AuthServerConfig) {
  return convexBetterAuthNextJs({
    convexUrl: config.convexUrl,
    convexSiteUrl: config.convexSiteUrl,
  });
}

export type AuthServerUtils = ReturnType<typeof createAuthServerUtils>;
