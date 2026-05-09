import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * PLAN_010 — content panel auto-expand on dispatcher navigate.
 *
 * Closes the agent-UI parity gap where the dispatcher pushes a new content URL
 * but a manually-collapsed content panel stays collapsed because
 * `useContentPanelController`'s layout effect only fires on the
 * `hasContentRoute: false → true` transition. The fix is a workspace panel
 * bridge that the dispatcher imperatively asks to "ensure the panel is open"
 * before every `router.push`.
 *
 * Note: every UI surface that calls `useCloneActions` today (profile tabs,
 * article/post list items, featured cards) lives inside the content panel
 * and becomes `inert` when the panel is collapsed. The user-UI half of the
 * dispatcher contract is therefore pinned end-to-end at the unit level
 * (see `_providers/__tests__/clone-actions-context.test.tsx` →
 * `panel-bridge integration` block) — these e2e tests cover the
 * platform-level invariants only:
 *   1. Negative regression — clicking a tab while the panel is already
 *      open does NOT clobber a manually-resized layout (no flicker).
 *   2. Mobile dispatcher navigation does not depend on the bridge.
 *
 * The agent-driven case (the actual user-visible bug repro) lives in
 * `content-panel-auto-expand.authenticated.spec.ts` because it loads the
 * `e2e/.auth/user.json` storage state and exercises the real LLM.
 */

const username = "rick-rubin";

async function getPanelWidth(locator: Locator) {
  return locator.evaluate((element) => {
    return Math.round(element.getBoundingClientRect().width);
  });
}

async function dragHandleBy(page: Page, handle: Locator, deltaX: number) {
  const handleBox = await handle.boundingBox();
  if (!handleBox) {
    throw new Error("Resizable handle is not visible");
  }
  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, {
    steps: Math.max(16, Math.round(Math.abs(deltaX) / 20)),
  });
  await page.mouse.up();
  // Same recovery pattern as `profile-content-panel-toggle.spec.ts`:
  // react-resizable-panels can miss the synthetic pointerup at the
  // collapse boundary — a follow-up no-button move + up clears the
  // stuck drag state.
  await page.mouse.move(10, 10);
  await page.mouse.up();
}

test.describe("Content panel auto-expand — platform invariants (PLAN_010)", () => {
  test("clicking a tab while the panel is already open does not clobber a manually-resized layout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`);

    const contentRegion = page.getByTestId("desktop-content-panel");
    const contentResizablePanel = page
      .locator('[data-slot="resizable-panel"]')
      .nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');

    await expect(contentRegion).toHaveAttribute("data-state", "open", {
      timeout: 10_000,
    });

    await dragHandleBy(page, handle, 220);

    const widthBefore = await getPanelWidth(contentResizablePanel);

    // Click a tab — bridge fires, but ensureExpanded is a no-op when not
    // collapsed. The user's chosen width must be preserved (not reset to 50/50).
    await page.getByRole("tab", { name: "Articles" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles(\\?|$)`),
      { timeout: 10_000 },
    );
    await expect(contentRegion).toHaveAttribute("data-state", "open");

    const widthAfter = await getPanelWidth(contentResizablePanel);
    expect(Math.abs(widthAfter - widthBefore)).toBeLessThan(20);
  });

  test("mobile: dispatcher navigation does not depend on the bridge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/@${username}/articles`);

    // Mobile route nav drives the visual swap; the bridge is unregistered
    // on mobile. URL must still resolve to the detail page.
    const firstArticleLink = page
      .locator(`a[href*="/@${username}/articles/"]`)
      .first();
    await expect(firstArticleLink).toBeVisible({ timeout: 10_000 });
    await firstArticleLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/[^/?#]+`),
      { timeout: 10_000 },
    );
  });
});
