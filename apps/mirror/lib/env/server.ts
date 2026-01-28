import { z } from "zod";

/**
 * Server-side environment variable validation.
 * These variables are only available on the server and should
 * never be exposed to the client.
 */

const serverEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.string().url("NEXT_PUBLIC_CONVEX_SITE_URL must be a valid URL"),
});

function validateServerEnv() {
  // Only validate on the server
  if (typeof window !== "undefined") {
    throw new Error("Server environment variables should not be accessed on the client");
  }

  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `❌ Missing or invalid server environment variables:\n${errors}\n\n` +
        `Set these in your .env.local file:\n` +
        `  NEXT_PUBLIC_CONVEX_URL="https://your-convex-deployment.convex.cloud"\n` +
        `  NEXT_PUBLIC_CONVEX_SITE_URL="https://yourapp.com"`
    );
  }

  return result.data;
}

export const serverEnv = validateServerEnv();

export type ServerEnv = z.infer<typeof serverEnvSchema>;
