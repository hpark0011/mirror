import { z } from "zod";
import { normalizeBaseUrl } from "./url";

type ServerEnvSource = {
  [key: string]: string | undefined;
  NEXT_PUBLIC_CONVEX_URL?: string | undefined;
  CONVEX_SITE_URL?: string | undefined;
  NEXT_PUBLIC_CONVEX_SITE_URL?: string | undefined;
  TAVUS_API_KEY?: string | undefined;
  TAVUS_PERSONA_ID?: string | undefined;
};

const baseUrl = (name: string) =>
  z
    .string()
    .trim()
    .url(`${name} must be a valid URL`)
    .transform(normalizeBaseUrl);

function deriveConvexSiteUrl(
  convexUrl: string | undefined,
): string | undefined {
  if (!convexUrl) return undefined;

  try {
    const url = new URL(convexUrl);
    if (url.hostname.endsWith(".convex.cloud")) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
      return normalizeBaseUrl(url.origin);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const serverEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_CONVEX_URL must be a valid URL")
    .refine((url) => url.startsWith("https://"), {
      message: "NEXT_PUBLIC_CONVEX_URL must use HTTPS",
    })
    .transform(normalizeBaseUrl),
  CONVEX_SITE_URL: baseUrl("CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL"),
  TAVUS_API_KEY: z.string().min(1, "TAVUS_API_KEY is required"),
  TAVUS_PERSONA_ID: z.string().min(1).default("p2679f6eae3f"),
});

export function resolveServerEnv(source: ServerEnvSource) {
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_CONVEX_URL: source.NEXT_PUBLIC_CONVEX_URL,
    CONVEX_SITE_URL:
      source.CONVEX_SITE_URL ??
      deriveConvexSiteUrl(source.NEXT_PUBLIC_CONVEX_URL) ??
      source.NEXT_PUBLIC_CONVEX_SITE_URL,
    TAVUS_API_KEY: source.TAVUS_API_KEY,
    TAVUS_PERSONA_ID: source.TAVUS_PERSONA_ID,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `❌ Missing or invalid server environment variables:\n${errors}\n\n` +
        `Set these in your deployment environment:\n` +
        `  NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"\n` +
        `  CONVEX_SITE_URL="https://your-deployment.convex.site" # optional when NEXT_PUBLIC_CONVEX_URL ends in .convex.cloud\n` +
        `  TAVUS_API_KEY="your-tavus-api-key"`,
    );
  }

  return result.data;
}

export type ServerEnv = ReturnType<typeof resolveServerEnv>;
