import { expect, test, type Page } from "@playwright/test";

/**
 * Profile tabs dispatcher parity (workspace/plans/2026-05-06-profile-tabs-dispatcher-parity-plan.md).
 *
 * Pins the user-UI half of the "two routes, one dispatcher" pattern for
 * profile tabs. Every ProfileTab click funnels through
 * `useCloneActions().navigateToProfileSection`, so the chat-aware suffix
 * and `scroll: false` invariants are applied in exactly one place — the
 * same dispatcher the agent watcher dispatches through. The agent path's
 * cross-user isolation (which closes over `profileOwnerId` server-side)
 * is already pinned by the unit tests in
 * `packages/convex/convex/chat/__tests__/tools.test.ts` (the `inputSchema
 * invariants` block + the `openProfileSection — execute` describe block).
 *
 * Pre-conditions: rick-rubin fixture user has at least one published article,
 * one published post, and one bio entry. This is the same fixture
 * `chat-agent-navigates.authenticated.spec.ts` and the bio specs lean on.
 *
 * The owner-only Clone Settings tab requires an authenticated session and
 * lives in a sibling `*.authenticated.spec.ts` (Step 7 / assertion #2 of
 * the plan); this file covers the visitor-visible sections.
 */

const username = "rick-rubin";

async function gotoTab(
  page: Page,
  tab: "bio" | "articles" | "posts",
  query = "",
) {
  await page.setViewportSize({ width: 1440, height: 960 });
  const url = `/@${username}/${tab}${query ? `?${query}` : ""}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

test.describe("Profile tabs dispatcher — visitor sections (bio / articles / posts)", () => {
  for (const start of ["posts", "articles"] as const) {
    test(`clicking the Bio tab from /@user/${start}?chat=1 pivots URL to /bio and preserves chat=1`, async ({
      page,
    }) => {
      await gotoTab(page, start, "chat=1");

      // Wait for the tab row to render before clicking.
      const bioTab = page.getByRole("tab", { name: "Bio" });
      await expect(bioTab).toBeVisible({ timeout: 10_000 });

      await bioTab.click();

      await expect(page).toHaveURL(
        new RegExp(`/@${username}/bio(?:\\?|$)`),
        { timeout: 10_000 },
      );
      // Chat-aware suffix preserved by the dispatcher's
      // `buildChatAwareHref` call.
      expect(page.url()).toMatch(/[?&]chat=1\b/);

      // Bio panel rendered — proves the click actually navigated, not just
      // mutated the URL.
      await expect(page.getByTestId("bio-panel")).toBeVisible({
        timeout: 10_000,
      });
    });
  }

  test("clicking the Articles tab from /@user/posts?chat=1 pivots URL and preserves chat=1", async ({
    page,
  }) => {
    await gotoTab(page, "posts", "chat=1");

    const articlesTab = page.getByRole("tab", { name: "Articles" });
    await expect(articlesTab).toBeVisible({ timeout: 10_000 });

    await articlesTab.click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles(?:\\?|$)`),
      { timeout: 10_000 },
    );
    expect(page.url()).toMatch(/[?&]chat=1\b/);
  });

  test("clicking the Posts tab from /@user/articles?chat=1 pivots URL and preserves chat=1", async ({
    page,
  }) => {
    await gotoTab(page, "articles", "chat=1");

    const postsTab = page.getByRole("tab", { name: "Posts" });
    await expect(postsTab).toBeVisible({ timeout: 10_000 });

    await postsTab.click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts(?:\\?|$)`),
      { timeout: 10_000 },
    );
    expect(page.url()).toMatch(/[?&]chat=1\b/);
  });

  test("cmd-click on a tab opens a new tab and leaves the original URL unchanged", async ({
    page,
    context,
  }) => {
    // Pins the open-in-new-tab semantics. The dispatcher's `handleClick`
    // early-returns on modifier keys, surrendering to the default `<Link>`
    // behaviour.
    await gotoTab(page, "posts", "chat=1");

    const bioTab = page.getByRole("tab", { name: "Bio" });
    await expect(bioTab).toBeVisible({ timeout: 10_000 });

    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      bioTab.click({ modifiers: ["Meta"] }),
    ]);

    await newPage.waitForLoadState("domcontentloaded");
    expect(newPage.url()).toMatch(
      new RegExp(`/@${username}/bio(?:\\?|$)`),
    );

    // Original tab still on /posts with the chat suffix intact.
    expect(page.url()).toMatch(new RegExp(`/@${username}/posts`));
    expect(page.url()).toMatch(/[?&]chat=1\b/);

    await newPage.close();
  });

  test("direct goto /@user/bio still renders the bio panel (cold-load regression guard)", async ({
    page,
  }) => {
    // Confirms the dispatcher does not interfere with cold loads. The
    // `<Link href>` is still populated — the only behavioural change is
    // that left-clicks route through `useCloneActions`.
    await gotoTab(page, "bio");

    await expect(page.getByTestId("bio-panel")).toBeVisible({
      timeout: 10_000,
    });
  });

  for (const tab of ["articles", "posts"] as const) {
    test(`direct goto /@user/${tab} renders without errors (cold-load regression guard)`, async ({
      page,
    }) => {
      await gotoTab(page, tab);

      await expect(
        page.getByRole("tab", {
          name: tab === "articles" ? "Articles" : "Posts",
        }),
      ).toBeVisible({ timeout: 10_000 });
    });
  }
});
