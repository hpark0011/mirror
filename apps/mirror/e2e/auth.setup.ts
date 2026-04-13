import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate test user", async ({ request }) => {
  const testSecret = process.env.PLAYWRIGHT_TEST_SECRET;
  if (!testSecret) {
    throw new Error(
      "PLAYWRIGHT_TEST_SECRET env var is not set. " +
        "Set it in .env.local or .env.test before running authenticated tests."
    );
  }

  const response = await request.post("/api/test/session", {
    headers: {
      "x-test-secret": testSecret,
      "content-type": "application/json",
    },
    data: { email: "playwright-test@mirror.test" },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `test-session route failed with status ${response.status()}: ${body}`
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.rmSync(authFile, { force: true });

  await request.storageState({ path: authFile });
});
