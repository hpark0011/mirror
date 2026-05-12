import { type Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth";

/**
 * Contact tab — authenticated owner CRUD spec.
 *
 * Verifies:
 *   - Owner sees Add CTA + per-card Edit/Delete controls.
 *   - Add flow creates a row that appears in the list (optimistic update).
 *   - Edit flow updates the value in place.
 *   - Delete flow removes the row.
 *   - Trying to add a second entry of the same platform surfaces a toast
 *     error (server-enforced one-per-platform invariant).
 *
 * Uses the canonical Playwright user `test-user` (shared via auth.setup.ts).
 */

const username = "test-user";
const testEmail = "playwright-test@mirror.test";

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;
const testSecret = process.env.PLAYWRIGHT_TEST_SECRET!;

type ContactKind =
  | "email"
  | "linkedin"
  | "instagram"
  | "x"
  | "tiktok"
  | "youtube";

type SeedEntry = {
  kind: ContactKind;
  value: string;
};

/**
 * Wait for Convex's auth handshake to complete on the client. Same pattern as
 * bio's owner-CRUD spec — mutations fired immediately after the cards render
 * race the ConvexBetterAuthProvider's auth-token plumbing and surface as
 * server-side "Unauthenticated" errors despite a valid session.
 */
async function waitForAuthReady(page: Page): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax -- pending auth-ready signal
  await page.waitForTimeout(1500);
}

async function ensureContactFixtures(
  entries: ReadonlyArray<SeedEntry>,
): Promise<void> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-contact-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: testEmail, entries }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ensure-contact-fixtures failed (${res.status}): ${body}`);
  }
}

// All authenticated owner tests share the canonical playwright-test user;
// serialize to avoid concurrent fixture rewrites racing across workers.
test.describe.configure({ mode: "serial" });

test.describe("Contact tab — authenticated owner CRUD", () => {
  test.beforeEach(async () => {
    await ensureContactFixtures([]);
  });

  test("owner sees Add CTA and per-card Edit/Delete controls", async ({
    authenticatedPage: page,
  }) => {
    await ensureContactFixtures([
      { kind: "email", value: "hpark0011@gmail.com" },
    ]);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/contact`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });

    await expect(
      page.getByTestId("contact-add-entry-button").first(),
    ).toBeVisible({ timeout: 5_000 });

    const card = page.getByTestId("contact-entry-card").first();
    await expect(card).toBeVisible();
    // Edit / Delete use `group-hover:flex` so they're `display:none` until the
    // card is hovered. Hover first to surface the controls.
    await card.hover();
    await expect(card.getByTestId("contact-entry-edit")).toBeVisible();
    await expect(card.getByTestId("contact-entry-delete")).toBeVisible();
  });

  test("Add → fill → submit creates the entry and the dialog closes synchronously", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/contact`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });
    await waitForAuthReady(page);

    await page.getByTestId("contact-add-entry-button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Default kind is "email" (first available). Fill with the user-provided
    // real value and submit.
    await dialog
      .getByTestId("contact-value-input")
      .fill("hpark0011@gmail.com");
    await dialog.getByRole("button", { name: /^add$/i }).click();

    // Dialog closes synchronously on submit.
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    const card = page.locator(
      '[data-testid="contact-entry-card"][data-kind="email"]',
    );
    await expect(card).toBeVisible({ timeout: 5_000 });
    await expect(card).toContainText("hpark0011@gmail.com");
  });

  test("Edit updates the value in place via Convex live query", async ({
    authenticatedPage: page,
  }) => {
    await ensureContactFixtures([
      { kind: "linkedin", value: "https://www.linkedin.com/in/old-handle" },
    ]);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/contact`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });

    const card = page.getByTestId("contact-entry-card").first();
    await expect(card).toContainText("old-handle");

    await waitForAuthReady(page);

    // Edit button is hidden by `group-hover:flex` — hover the row first.
    await card.hover();
    await card.getByTestId("contact-entry-edit").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const valueInput = dialog.getByTestId("contact-value-input");
    await valueInput.fill("https://www.linkedin.com/in/hyunsolpark/");
    await dialog.getByRole("button", { name: /^save$/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await expect(card).toContainText("hyunsolpark", { timeout: 5_000 });
  });

  test("Delete removes the row; refresh confirms persistence", async ({
    authenticatedPage: page,
  }) => {
    await ensureContactFixtures([
      { kind: "x", value: "https://x.com/hpark0011" },
      { kind: "email", value: "hpark0011@gmail.com" },
    ]);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/contact`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });

    const cards = page.getByTestId("contact-entry-card");
    await expect(cards).toHaveCount(2, { timeout: 5_000 });

    await waitForAuthReady(page);

    const xCard = page.locator(
      '[data-testid="contact-entry-card"][data-kind="x"]',
    );
    // Edit / Delete render via `group-hover:flex` so hover the row first.
    await xCard.hover();
    await xCard.getByTestId("contact-entry-delete").click();

    await expect(cards).toHaveCount(1, { timeout: 5_000 });

    // Reload — deletion persists server-side.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("contact-entry-card")).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-kind="x"]'),
    ).toHaveCount(0);
  });

  test("one-per-platform: server rejects a second entry of the same kind and shows a toast", async ({
    authenticatedPage: page,
  }) => {
    // Seed an existing LinkedIn entry; the kind select hides it from the
    // available list, so to exercise the server's one-per-platform reject path
    // we re-seed mid-flow (the dialog opens before the seed, the value is
    // filled, then we re-seed via the test helper before submit). The form's
    // kind field still has its original options, so submit fires the create
    // mutation server-side, which the by_userId_and_kind index rejects.
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/contact`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });
    await waitForAuthReady(page);

    // Open the dialog with no entries yet.
    await page.getByTestId("contact-add-entry-button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Pick LinkedIn from the kind select.
    await dialog.getByTestId("contact-kind-trigger").click();
    await page.getByRole("option", { name: "LinkedIn" }).click();
    await dialog
      .getByTestId("contact-value-input")
      .fill("https://www.linkedin.com/in/hyunsolpark/");

    // Seed another LinkedIn server-side before the user clicks Add — server
    // will reject the duplicate insert.
    await ensureContactFixtures([
      { kind: "linkedin", value: "https://www.linkedin.com/in/existing" },
    ]);

    await dialog.getByRole("button", { name: /^add$/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });

    const toast = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /LinkedIn contact already exists/i });
    await expect(toast).toBeVisible({ timeout: 5_000 });
  });
});
