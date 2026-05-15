import { withoutTrailingSlash } from "@/lib/url";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or .env.test before running e2e tests.`,
    );
  }
  return value;
}

export function requireEnvUrl(name: string): string {
  return withoutTrailingSlash(requireEnv(name));
}
