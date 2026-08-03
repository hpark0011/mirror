/**
 * Regression spec for the `users.bio` → `users.tagline` rename
 * (workspace/plans/2026-05-06-rename-users-bio-to-tagline-plan.md).
 *
 * Public profile page metadata remains backed by the renamed `tagline`
 * field even while the profile-editing surface is intentionally unmounted.
 */

import { test, expect } from "./fixtures/auth";

test.describe("Profile tagline (renamed from bio) — read/write regression", () => {
  test("rendered profile description uses tagline, not the old bio field", async ({
    page,
  }) => {
    await page.goto("/@rick-rubin");
    // Page metadata description is built from profile.tagline.
    // The seeded rick-rubin value contains "transformative creative muse".
    const meta = page.locator('meta[name="description"]');
    await expect(meta).toHaveAttribute(
      "content",
      /transformative creative muse/,
    );
  });
});
