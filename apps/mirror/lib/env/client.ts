import { z } from "zod";

/**
 * Client-side environment variable validation.
 * These variables must be prefixed with NEXT_PUBLIC_ and are
 * inlined at build time.
 */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
  NEXT_PUBLIC_CONVEX_URL: z
    .string()
    .url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
});

function validateClientEnv() {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `❌ Missing or invalid client environment variables:\n${errors}\n\n` +
        `Set these in your .env.local file:\n` +
        `  NEXT_PUBLIC_SITE_URL="https://yourapp.com"\n` +
        `  NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"`
    );
  }

  return result.data;
}

export const clientEnv = validateClientEnv();

export type ClientEnv = z.infer<typeof clientEnvSchema>;
