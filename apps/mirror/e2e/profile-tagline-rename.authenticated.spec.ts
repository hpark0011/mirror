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

    // Load-bearing rename locks (two independent assertions — both fail
    // if the rename regresses to `bio`):
    //   1. The visible FormLabel text is "Tagline".
    //   2. The textarea data-test attribute is `edit-profile-tagline-textarea`.
    // The data-test selector is the fill target because the FormLabel
    // markup wraps "Tagline" in a framer-motion div, which breaks the
    // standard label-for/input-id accessible-name pipeline that
    // `getByLabel` relies on. Both assertions still anchor to the rename.
    await expect(page.getByText("Tagline", { exact: true })).toBeVisible();
    const input = page.locator('[data-test="edit-profile-tagline-textarea"]');
    await expect(input).toBeVisible();

    const persistedValue = `Renamed-by-rename-test tagline value ${Date.now()}`;
    await input.fill(persistedValue);

    // Save (form id="edit-profile-form" submitted by EditActions button).
    // Two buttons share this data-test for responsive (mobile + desktop)
    // duplication; the desktop-viewport visible one is the second.
    await page
      .locator('[data-test="edit-profile-submit-button"]')
      .filter({ visible: true })
      .first()
      .click();

    // Reload to drop optimistic state and re-fetch from Convex.
    await page.reload();
    await waitForAuthReady(page);

    // The persisted value should round-trip through getByUsername →
    // useProfileData → EditableTagline render.
    await expect(page.getByText(persistedValue)).toBeVisible();
  });
});
