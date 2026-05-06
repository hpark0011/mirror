/**
 * Regression spec for the `users.bio` → `users.tagline` rename
 * (workspace/plans/2026-05-06-rename-users-bio-to-tagline-plan.md).
 *
 * Two locks:
 *   1. Public profile page-meta `description` is built from the renamed
 *      `tagline` field. Pinned to a substring of the rick-rubin seed.
 *   2. Authenticated edit form persists the tagline through Convex; the
 *      `getByLabel(/Tagline/i)` selector is the load-bearing assertion —
 *      if the form-field name regresses to `bio`, RHF + zodResolver +
 *      shadcn FormLabel association break and the test fails.
 *
 * The plan's spec body uses `getByTestId("profile-edit-toggle")` and
 * `profile-edit-save`. The codebase uses:
 *   - `aria-label="Edit Profile"` on the trigger button
 *     (`features/profile/components/edit-profile-button.tsx`)
 *   - `data-test="edit-profile-submit-button"` on the save button
 *     (`features/profile/components/edit-actions.tsx`)
 * Selectors below match the actual implementation.
 */

import { test, expect, waitForAuthReady } from "./fixtures/auth";

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

  test("profile-info edit form persists tagline through Convex", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/@test-user");
    await waitForAuthReady(page);

    // Enter edit mode via the EditProfileButton (aria-label="Edit Profile").
    await page.getByRole("button", { name: "Edit Profile" }).click();

    // Load-bearing selector — the form-field label must be "Tagline".
    // If the rename regresses, this resolves to no element and fails fast.
    const input = page.getByLabel(/Tagline/i);
    const persistedValue = `Renamed-by-rename-test tagline value ${Date.now()}`;
    await input.fill(persistedValue);

    // Save (form id="edit-profile-form" submitted by EditActions button).
    await page.locator('[data-test="edit-profile-submit-button"]').click();

    // Reload to drop optimistic state and re-fetch from Convex.
    await page.reload();
    await waitForAuthReady(page);

    // The persisted value should round-trip through getByUsername →
    // useProfileData → EditableTagline render.
    await expect(page.getByText(persistedValue)).toBeVisible();
  });
});
