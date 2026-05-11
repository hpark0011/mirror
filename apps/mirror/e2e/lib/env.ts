import { normalizeBaseUrl } from "../../lib/env/url";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or .env.test before running e2e tests.`,
    );
  }
  return name.endsWith("_URL") ? normalizeBaseUrl(value) : value;
}
