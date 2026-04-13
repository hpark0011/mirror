import { expect, test } from "@playwright/test";

const username = "rick-rubin";

test.describe("Post markdown upload", () => {
  test("posts page loads without runtime errors from upload feature code", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, {
      waitUntil: "domcontentloaded",
    });

    // Wait for content to render — toolbar should be present
    await page.waitForSelector("[class*='toolbar'], [class*='border-b']", {
      timeout: 15000,
    });

    // No runtime errors on the page
    expect(errors).toHaveLength(0);
  });
});
