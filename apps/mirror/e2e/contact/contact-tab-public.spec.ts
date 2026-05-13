import { test, expect, type Page } from "@playwright/test";

/**
 * Contact tab — signed-out visitor spec.
 *
 * Verifies the public-facing read path of the contact panel:
 *   - `/@<user>/contact` returns 200, panel renders, "Contact" tab visible
 *   - entry cards expose platform label + value with secure anchor attrs
 *     (target=_blank + rel=noopener noreferrer for URL kinds, mailto: for email)
 *   - owner controls (Add / Edit / Delete) are absent for signed-out visitors
 *   - empty contact shows the "no entries yet" state
 *
 * Mirrors `bio-tab-public.spec.ts` — each scenario uses a unique test user so
 * parallel workers can't race fixture writes.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to run contact Playwright specs`);
  }
  return value;
}

const convexSiteUrl = requireEnv("NEXT_PUBLIC_CONVEX_SITE_URL");
const testSecret = requireEnv("PLAYWRIGHT_TEST_SECRET");

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

async function ensureContactFixtures(
  email: string,
  entries: ReadonlyArray<SeedEntry>,
): Promise<void> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-contact-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email, entries }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-contact-fixtures failed (${res.status}) for ${email}: ${body}`,
    );
  }
}

async function ensureTestUser(email: string, name: string): Promise<void> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-user`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email, username: name }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-user failed (${res.status}) for ${email}: ${body}`,
    );
  }
}

async function gotoContact(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${name}/contact`, { waitUntil: "domcontentloaded" });
}

async function setupScenarioUser(scenario: string): Promise<{
  username: string;
  email: string;
}> {
  const username = `contact-${scenario}`;
  const email = `playwright-contact-${scenario}@mirror.test`;
  await ensureTestUser(email, username);
  return { username, email };
}

test.describe("Contact tab — signed-out visitor", () => {
  test("panel renders, tab trigger present, content panel is OPEN", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("render");
    await ensureContactFixtures(email, [
      { kind: "email", value: "contact-user@example.com" },
    ]);

    await gotoContact(page, username);

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByRole("tab", { name: "Contact" })).toBeVisible({
      timeout: 5_000,
    });

    await expect(page.getByTestId("desktop-content-panel")).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  test("entry cards render label + value; URL kinds get target=_blank + rel=noopener noreferrer; email uses mailto", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("anchors");
    await ensureContactFixtures(email, [
      { kind: "email", value: "contact-user@example.com" },
      { kind: "linkedin", value: "https://www.linkedin.com/in/test-user/" },
      { kind: "instagram", value: "https://www.instagram.com/test-user/" },
      { kind: "x", value: "https://x.com/test-user" },
    ]);

    await gotoContact(page, username);

    const cards = page.getByTestId("contact-entry-card");
    await expect(cards).toHaveCount(4, { timeout: 10_000 });

    // Card kind discriminator lives on the article ELEMENT (`data-kind`), so
    // a direct CSS selector beats `filter({ has })` which only matches
    // descendants. The Locator is scoped by both testid AND attribute.
    const emailCard = page.locator(
      '[data-testid="contact-entry-card"][data-kind="email"]',
    );
    await expect(emailCard).toContainText("Email");
    await expect(emailCard).toContainText("contact-user@example.com");
    const emailLink = emailCard.getByTestId("contact-entry-link");
    await expect(emailLink).toHaveAttribute(
      "href",
      "mailto:contact-user@example.com",
    );

    const liCard = page.locator(
      '[data-testid="contact-entry-card"][data-kind="linkedin"]',
    );
    await expect(liCard).toContainText("LinkedIn");
    const liLink = liCard.getByTestId("contact-entry-link");
    await expect(liLink).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/test-user/",
    );
    await expect(liLink).toHaveAttribute("target", "_blank");
    await expect(liLink).toHaveAttribute("rel", "noopener noreferrer");

    const xCard = page.locator(
      '[data-testid="contact-entry-card"][data-kind="x"]',
    );
    await expect(xCard).toContainText("X");
    const xLink = xCard.getByTestId("contact-entry-link");
    await expect(xLink).toHaveAttribute("href", "https://x.com/test-user");
    await expect(xLink).toHaveAttribute("target", "_blank");
    await expect(xLink).toHaveAttribute("rel", "noopener noreferrer");

    // Signed-out visitors never see owner controls.
    await expect(page.getByTestId("contact-entry-edit")).toHaveCount(0);
    await expect(page.getByTestId("contact-entry-delete")).toHaveCount(0);
    await expect(page.getByTestId("contact-add-entry-button")).toHaveCount(0);
  });

  test("empty contact shows the visitor empty state", async ({ page }) => {
    const { username, email } = await setupScenarioUser("empty");
    await ensureContactFixtures(email, []);

    await gotoContact(page, username);

    await expect(page.getByTestId("contact-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("contact-entry-list-empty")).toBeVisible();
    await expect(
      page.getByText("No contact information yet.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByTestId("contact-add-entry-button")).toHaveCount(0);
  });
});
