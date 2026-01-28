import { z } from "zod";

/**
 * Environment variable validation schema for Convex backend.
 * Validates required environment variables at startup to provide
 * clear error messages instead of cryptic runtime failures.
 */

const envSchema = z.object({
  SITE_URL: z.string().url("SITE_URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `❌ Missing or invalid environment variables:\n${errors}\n\n` +
        `Set these in your Convex dashboard or via CLI:\n` +
        `  npx convex env set SITE_URL "https://yourapp.com"\n` +
        `  npx convex env set GOOGLE_CLIENT_ID "your-client-id"\n` +
        `  npx convex env set GOOGLE_CLIENT_SECRET "your-client-secret"`
    );
  }

  return result.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;
