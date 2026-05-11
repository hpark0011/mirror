import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { normalizeBaseUrl } from "./lib/env/url";

// Load .env.local for Playwright's Node process (Next.js loads it automatically
// for the dev server, but the test runner is separate). Existing process.env
// values win so CI overrides are respected.
loadEnv({ path: resolve(__dirname, ".env.local"), override: false });

for (const name of [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_SITE_URL",
]) {
  const value = process.env[name];
  if (value) {
    process.env[name] = normalizeBaseUrl(value);
  }
}

function resolvePort(): number {
  const explicitPort = process.env.MIRROR_PORT ?? process.env.PORT;
  if (explicitPort) {
    return Number.parseInt(explicitPort, 10);
  }

  const allocatedPort = execFileSync(
    process.execPath,
    [
      resolve(__dirname, "../../scripts/with-worktree-port.mjs"),
      "mirror",
      "--print",
    ],
    { encoding: "utf8" },
  ).trim();

  return Number.parseInt(allocatedPort, 10);
}

const port = resolvePort();
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/auth\.setup\.ts/, /.*\.authenticated\.spec\.ts/],
    },
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testMatch: /.*\.authenticated\.spec\.ts/,
    },
  ],
  webServer: {
    command: `MIRROR_PORT=${port} PORT=${port} PLAYWRIGHT_BASE_URL=${baseURL} pnpm dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
