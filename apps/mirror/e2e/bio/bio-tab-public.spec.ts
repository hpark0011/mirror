import { test, expect, type Page } from "@playwright/test";

/**
 * Wave 4 — Bio tab public visitor spec.
 *
 * Verifies (per workspace/spec/2026-04-30-bio-tab-spec.md):
 *   - FR-01 — `/@<user>/bio` returns 200 + bio panel rendered + "Bio" tab trigger
 *   - FR-02 — entry cards render kind/title/date-range; description+link only when set;
 *             link uses `target="_blank"` AND `rel="noopener noreferrer"`
 *   - FR-09 — entries rendered in DOM order desc by startDate
 *   - FR-10 — public query caps at 50 entries even when 51+ are seeded
 *   - FR-17 — empty bio shows the "no entries yet" empty card for visitors
 *   - Issue C3 — content panel is OPEN (data-state="open") at /@<user>/bio,
 *               locking the `hasContentRoute=true, routeState=null` contract.
 *
 * Each test uses a unique `<scenario>` test user and email so Playwright's
 * `fullyParallel: true` worker pool can't race fixture seeds (every test had
 * to share `playwright-test@mirror.test` would mean overlapping
 * ensure-bio-fixtures rewrites). The tests are otherwise independent.
 */

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;
const testSecret = process.env.PLAYWRIGHT_TEST_SECRET!;

type SeedEntry = {
  kind: "work" | "education";
  title: string;
  startDate: number;
  endDate: number | null;
  description?: string;
  link?: string;
};

/**
 * Anchored to the first of the given month UTC, matching the `startDate`
 * convention enforced by `bio.mutations.create`.
 */
function monthEpoch(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1);
}

async function ensureBioFixtures(
  email: string,
  entries: ReadonlyArray<SeedEntry>,
): Promise<void> {
  if (!convexSiteUrl) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_SITE_URL must be set to run bio Playwright specs",
    );
  }
  if (!testSecret) {
    throw new Error(
      "PLAYWRIGHT_TEST_SECRET must be set to run bio Playwright specs",
    );
  }
  const res = await fetch(`${convexSiteUrl}/test/ensure-bio-fixtures`, {
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
      `ensure-bio-fixtures failed (${res.status}) for ${email}: ${body}`,
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

async function gotoBio(page: Page, name: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${name}/bio`, { waitUntil: "domcontentloaded" });
}

/**
 * Helper to set up an isolated test user. Each scenario gets its own
 * username + email pair so parallel workers don't race fixture writes.
 */
async function setupScenarioUser(scenario: string): Promise<{
  username: string;
  email: string;
}> {
  const username = `bio-${scenario}`;
  const email = `playwright-bio-${scenario}@mirror.test`;
  await ensureTestUser(email, username);
  return { username, email };
}

test.describe("Bio tab — signed-out visitor", () => {
  test("FR-01 + Issue C3: panel renders, tab trigger present, content panel is OPEN", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("fr01");
    await ensureBioFixtures(email, [
      {
        kind: "work",
        title: "Founding Engineer at Mirror",
        startDate: monthEpoch(2024, 1),
        endDate: null,
      },
    ]);

    await gotoBio(page, username);

    // FR-01: bio panel rendered
    await expect(page.getByTestId("bio-panel")).toBeVisible({
      timeout: 10_000,
    });

    // FR-01: "Bio" tab trigger present in profile-tabs row. Radix Tabs
    // gives each trigger role="tab".
    await expect(page.getByRole("tab", { name: "Bio" })).toBeVisible({
      timeout: 5_000,
    });

    // Issue C3: the content panel is OPEN at /@username/bio (locks the
    // hasContentRoute=true, routeState=null contract). The same data-state
    // attribute used by profile-content-panel-toggle.spec.ts.
    await expect(page.getByTestId("desktop-content-panel")).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  test("FR-02: entry cards render kind/title/date-range; link has target=_blank + rel=noopener noreferrer", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("fr02");
    await ensureBioFixtures(email, [
      {
        kind: "work",
        title: "Senior Engineer at Acme",
        startDate: monthEpoch(2022, 1),
        endDate: monthEpoch(2024, 3),
        description: "Led the migration of the billing pipeline.",
        link: "https://acme.example.com/blog/billing",
      },
      {
        kind: "education",
        title: "BS Computer Science, MIT",
        startDate: monthEpoch(2014, 9),
        endDate: monthEpoch(2018, 5),
        // No description, no link — the card should NOT render those slots.
      },
    ]);

    await gotoBio(page, username);

    const cards = page.getByTestId("bio-entry-card");
    await expect(cards).toHaveCount(2, { timeout: 10_000 });

    // Card with description + link
    const acmeCard = cards.filter({ hasText: "Senior Engineer at Acme" });
    await expect(acmeCard).toContainText("Work");
    await expect(acmeCard).toContainText("Senior Engineer at Acme");
    await expect(acmeCard).toContainText(/Jan 2022.*Mar 2024/);
    await expect(acmeCard).toContainText("Led the migration");

    const link = acmeCard.getByTestId("bio-entry-link");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute(
      "href",
      "https://acme.example.com/blog/billing",
    );

    // Card without description / link
    const mitCard = cards.filter({ hasText: "BS Computer Science, MIT" });
    await expect(mitCard).toContainText("Education");
    await expect(mitCard).toContainText(/Sep 2014.*May 2018/);
    await expect(mitCard.getByTestId("bio-entry-link")).toHaveCount(0);

    // FR-04 (signed-out branch): owner controls MUST NOT render on cards
    // for unauthenticated visitors. Locks the absence on cards that
    // actually exist — the empty-state coverage in FR-17 only proves the
    // add-CTA absence and not the per-card edit/delete absence.
    await expect(page.getByTestId("bio-entry-edit")).toHaveCount(0);
    await expect(page.getByTestId("bio-entry-delete")).toHaveCount(0);
    await expect(page.getByTestId("bio-add-entry-button")).toHaveCount(0);
  });

  test("FR-09: entries render in DOM order DESC by startDate", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("fr09");
    await ensureBioFixtures(email, [
      // Insert in random order — query layer is responsible for sorting.
      {
        kind: "work",
        title: "Middle Role",
        startDate: monthEpoch(2020, 6),
        endDate: monthEpoch(2022, 6),
      },
      {
        kind: "work",
        title: "Newest Role",
        startDate: monthEpoch(2024, 1),
        endDate: null,
      },
      {
        kind: "education",
        title: "Oldest Entry",
        startDate: monthEpoch(2014, 9),
        endDate: monthEpoch(2018, 5),
      },
    ]);

    await gotoBio(page, username);

    const cards = page.getByTestId("bio-entry-card");
    await expect(cards).toHaveCount(3, { timeout: 10_000 });

    const titles = await cards.evaluateAll((nodes) =>
      nodes
        .map((node) => node.querySelector("h3")?.textContent?.trim() ?? "")
        .filter(Boolean),
    );
    expect(titles).toEqual(["Newest Role", "Middle Role", "Oldest Entry"]);
  });

  test("FR-10: public query caps at 50 entries even when 51 seeded", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("fr10");

    // Seed 51 entries with strictly descending startDates so we can identify
    // which one is the OLDEST (and therefore must be the one excluded by the
    // 50-cap). January 2020 + i months yields a unique startDate per row.
    const totalEntries = 51;
    const entries: SeedEntry[] = Array.from(
      { length: totalEntries },
      (_, i) => ({
        kind: "work" as const,
        // Spread across 51 distinct months so sorting is deterministic.
        title: `Entry #${String(i).padStart(2, "0")}`,
        startDate: monthEpoch(2020 + Math.floor(i / 12), (i % 12) + 1),
        endDate: null,
      }),
    );
    await ensureBioFixtures(email, entries);

    await gotoBio(page, username);

    const cards = page.getByTestId("bio-entry-card");
    // The public query is capped to 50; the oldest (index 0) is excluded.
    await expect(cards).toHaveCount(50, { timeout: 15_000 });
  });

  test("FR-17: visitor on a user with 0 entries sees the 'No entries yet.' empty state", async ({
    page,
  }) => {
    const { username, email } = await setupScenarioUser("fr17");
    await ensureBioFixtures(email, []);

    await gotoBio(page, username);

    // Empty card present, with the visitor (non-owner) copy.
    const empty = page.getByTestId("bio-entry-list-empty");
    await expect(empty).toBeVisible({ timeout: 10_000 });
    await expect(empty).toContainText("No entries yet.");
    // No add CTA because the visitor is not the owner.
    await expect(empty.getByTestId("bio-add-entry-button")).toHaveCount(0);
  });
});
