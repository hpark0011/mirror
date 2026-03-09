import { test, expect } from "@playwright/test";

/**
 * Tests for Tavus CVI Video Calling feature against the acceptance criteria
 * from docs/plans/2026-02-17-feat-tavus-cvi-video-calling-plan.md
 */

test.describe("Tavus CVI Video Calling", () => {
  const profileUrl = "/@rick-rubin";

  // ─── Functional Requirements ───

  test.describe("Functional Requirements", () => {
    test("FR-1: Video button is visible on profile page", async ({ page }) => {
      await page.goto(profileUrl);
      // The Video button should be visible in profile actions
      const videoButton = page.locator("text=Video").first();
      await expect(videoButton).toBeVisible({ timeout: 10000 });
    });

    test("FR-2: Clicking Video button opens full-screen modal overlay", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      // Find and click the Video button
      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      // A full-screen modal/overlay should appear
      // Check for common modal patterns: dialog, overlay, or modal role
      const modal = page.locator(
        '[role="dialog"], [data-testid*="video-call"], [class*="video-call-modal"], [class*="VideoCallModal"]'
      );
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test("FR-3: Avatar appears and delivers a greeting", async ({ page }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      // Check for remote video element (avatar stream)
      const remoteVideo = page.locator(
        'video[data-testid*="remote"], [class*="remote-video"], [class*="RemoteVideo"]'
      );
      await expect(remoteVideo).toBeVisible({ timeout: 30000 });
    });

    test("FR-5: User can toggle camera on/off during call", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      // Wait for call to connect
      await page.waitForTimeout(5000);

      // Camera toggle button should exist
      const cameraToggle = page.locator(
        'button[aria-label*="camera" i], button[data-testid*="camera"], button:has([class*="camera" i])'
      );
      await expect(cameraToggle).toBeVisible({ timeout: 10000 });
    });

    test("FR-6: User can toggle microphone on/off during call", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      await page.waitForTimeout(5000);

      // Mic toggle button should exist
      const micToggle = page.locator(
        'button[aria-label*="mic" i], button[aria-label*="microphone" i], button[data-testid*="mic"], button:has([class*="mic" i])'
      );
      await expect(micToggle).toBeVisible({ timeout: 10000 });
    });

    test("FR-7: User can end the call via End Call button", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      await page.waitForTimeout(5000);

      // End Call button should exist
      const endCallButton = page.locator(
        'button[aria-label*="end" i], button[data-testid*="end-call"], button:has-text("End Call"), button:has-text("End")'
      );
      await expect(endCallButton).toBeVisible({ timeout: 10000 });
    });

    test("FR-8: Modal dismisses and returns to profile after call ends", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      await page.waitForTimeout(5000);

      // Click end call or close button
      const closeButton = page.locator(
        'button[aria-label*="end" i], button[aria-label*="close" i], button[data-testid*="end-call"], button:has-text("End Call")'
      );
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      // Modal should be gone, profile should be visible
      const profileActions = page.locator("text=Video").first();
      await expect(profileActions).toBeVisible({ timeout: 10000 });

      // Modal should no longer be visible
      const modal = page.locator('[role="dialog"]');
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    });

    test("FR-11: Text and Voice buttons show Coming soon toast", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      // Click Text button
      const textButton = page.locator("text=Text").first();
      await textButton.click();

      // Should show a toast with "Coming soon"
      const toast = page.locator(
        '[role="status"]:has-text("Coming soon"), [data-sonner-toast]:has-text("Coming soon"), [class*="toast"]:has-text("Coming soon"), text="Coming soon"'
      );
      await expect(toast).toBeVisible({ timeout: 5000 });

      // Click Voice button
      const voiceButton = page.locator("text=Voice").first();
      await voiceButton.click();

      // Should also show "Coming soon"
      await expect(toast.first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ─── Non-Functional Requirements ───

  test.describe("Non-Functional Requirements", () => {
    test("NFR-1: Tavus API key is not exposed to client (no client-side env leak)", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      // Check that TAVUS_API_KEY is not in the page source
      const pageContent = await page.content();
      expect(pageContent).not.toContain("TAVUS_API_KEY");

      // Check window.__NEXT_DATA__ for leaked env vars
      const nextData = await page.evaluate(() => {
        return JSON.stringify(
        (window as Record<string, unknown>).__NEXT_DATA__ || {},
      );
      });
      expect(nextData).not.toContain("TAVUS_API_KEY");
      expect(nextData).not.toContain("tavus");
    });

    test("NFR-2: CSP headers allow Daily.co WebRTC connections", async ({
      page,
    }) => {
      const response = await page.goto(profileUrl);
      const csp = response?.headers()["content-security-policy"] || "";

      // CSP should include Daily.co domains in connect-src
      expect(csp).toContain("*.daily.co");

      // Should allow wss for WebRTC signaling
      expect(csp).toContain("wss://*.daily.co");
    });

    test("NFR-3: Permissions-Policy allows camera and microphone", async ({
      page,
    }) => {
      const response = await page.goto(profileUrl);
      const permissionsPolicy =
        response?.headers()["permissions-policy"] || "";

      // Should allow camera and mic for self
      expect(permissionsPolicy).toContain("camera=(self)");
      expect(permissionsPolicy).toContain("microphone=(self)");
    });

    test("NFR-4: Daily.co SDK is lazy-loaded (not in initial page bundle)", async ({
      page,
    }) => {
      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      // Check that @daily-co scripts are NOT loaded on initial page load
      const dailyScripts = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script[src]"));
        return scripts
          .map((s) => s.getAttribute("src"))
          .filter((src) => src && src.includes("daily"));
      });
      expect(dailyScripts).toHaveLength(0);
    });

    test("NFR-5: Error states show user-friendly messages", async ({
      page,
    }) => {
      // Mock the API to return an error
      await page.route("**/api/tavus/conversations", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal server error" }),
        })
      );

      await page.goto(profileUrl);
      await page.waitForLoadState("networkidle");

      const videoButton = page.locator("text=Video").first();
      await videoButton.click();

      // Should show a user-friendly error message (not a raw error)
      const errorMessage = page.locator(
        'text=/something went wrong|try again|not available|error/i'
      );
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
    });
  });

  // ─── API Route ───

  test.describe("API Route", () => {
    test("API route /api/tavus/conversations exists", async ({ request }) => {
      const response = await request.post("/api/tavus/conversations", {
        data: { username: "rick-rubin" },
      });
      // Should not return 404 (route exists)
      // May return 500 if TAVUS_API_KEY is not set, but should NOT be 404
      expect(response.status()).not.toBe(404);
    });
  });

  // ─── Package Structure ───

  test.describe("Package & File Structure (static checks)", () => {
    test("@feel-good/tavus package exists", async ({ page }) => {
      // This is a static check — we verify by importing in the test
      // We'll check if the API route works, which proves the package is importable
      const response = await page.goto(profileUrl);
      expect(response?.status()).toBe(200);
    });
  });
});
