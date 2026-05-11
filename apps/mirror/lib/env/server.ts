import "server-only";
import { resolveServerEnv, type ServerEnv } from "./server-core";

export const serverEnv = resolveServerEnv({
  NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
  NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  TAVUS_API_KEY: process.env.TAVUS_API_KEY,
  TAVUS_PERSONA_ID: process.env.TAVUS_PERSONA_ID,
});

export type { ServerEnv };
