import { test, expect, waitForAuthReady } from "./fixtures/auth";
import { openChat, sendChatMessage } from "./helpers/chat";
import { type Page } from "@playwright/test";

const ownerUsername = "test-user";
const visitorProfileUsername = "removed-settings-visitor";
const visitorProfileEmail = "removed-settings-visitor@mirror.test";
const visibleTabs = ["Posts", "Articles", "Bio", "Contact", "Projects"];
const removedTabs = ["Clone", "Settings"];
const removedPaths = ["clone-settings", "settings"];

async function ensureVisitorProfile() {
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.replace(
    /\/$/,
    "",
  );
  if (!convexSiteUrl)
    throw new Error("NEXT_PUBLIC_CONVEX_SITE_URL is required");
  const response = await fetch(`${convexSiteUrl}/test/ensure-user`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": process.env.PLAYWRIGHT_TEST_SECRET!,
    },
    body: JSON.stringify({
      email: visitorProfileEmail,
      username: visitorProfileUsername,
    }),
  });
  if (!response.ok) {
    throw new Error(`Visitor profile setup failed: ${response.status}`);
  }
}

async function expectCurrentTabs(page: Page) {
  for (const label of visibleTabs) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }
  for (const label of removedTabs) {
    await expect(page.getByRole("tab", { name: label })).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: /configure profile/i }),
  ).toHaveCount(0);
}

test.describe("removed Clone and Settings surfaces", () => {
  test.describe.configure({ mode: "serial" });

  test("owner and visitor see only the five public profile tabs", async ({
    authenticatedPage: page,
  }) => {
    await ensureVisitorProfile();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${ownerUsername}/posts`);
    await waitForAuthReady(page);
    await expectCurrentTabs(page);

    // The signed-in test user does not own the seeded profile, so this is
    // the visitor rendering path without triggering onboarding middleware.
    await page.goto(`/@${visitorProfileUsername}/posts`);
    await expectCurrentTabs(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectCurrentTabs(page);
    await page.goto(`/@${ownerUsername}/posts`);
    await expectCurrentTabs(page);
  });

  test("removed routes return 404 for owner and visitor", async ({
    authenticatedPage: page,
  }) => {
    await ensureVisitorProfile();
    for (const path of removedPaths) {
      const response = await page.goto(`/@${ownerUsername}/${path}`);
      expect(response?.status()).toBe(404);
    }

    for (const path of removedPaths) {
      const response = await page.goto(`/@${visitorProfileUsername}/${path}`);
      expect(response?.status()).toBe(404);
    }
  });

  test("profile root always resolves to Posts", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/@${ownerUsername}`);
    await expect(page).toHaveURL(
      new RegExp(`/@${ownerUsername}/posts(?:\\?|$)`),
    );
    await expect(page.getByRole("tab", { name: "Posts" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  test("public chat sends without mode state and preserves chat state across tabs", async ({
    authenticatedPage: page,
  }) => {
    const message = `Removal regression ${Date.now()}`;
    const textarea = await openChat(page, ownerUsername);

    expect(page.url()).not.toContain("chatMode=");
    await sendChatMessage(textarea, message);
    await expect(textarea).toHaveValue("");
    await expect(page).toHaveURL(/[?&]conversation=[^&]+/, { timeout: 15_000 });
    expect(page.url()).not.toContain("chatMode=");

    const conversationId = new URL(page.url()).searchParams.get("conversation");
    expect(conversationId).toBeTruthy();
    await page.getByRole("tab", { name: "Articles" }).click();
    await expect(page).toHaveURL(new RegExp(`/@${ownerUsername}/articles`));
    expect(page.url()).toContain("chat=1");
    expect(page.url()).toContain(`conversation=${conversationId}`);
    expect(page.url()).not.toContain("chatMode=");
  });
});
