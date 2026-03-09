import { expect, test, type Locator, type Page } from "@playwright/test";

const username = "rick-rubin";
const articleSlug = "the-art-of-listening";
const articleTitle = "The Art of Listening";
const COLLAPSE_DELTA_X = 900;
const REVERSE_DELTA_X = 420;
const REOPEN_DELTA_X = -520;
const COLLAPSED_PANEL_MAX_WIDTH = 8;

async function instrumentPostsFetches(page: Page) {
  await page.addInitScript((postsPath) => {
    const trackedFetches: string[] = [];
    const windowWithTrackedFetches = window as typeof window & {
      __trackedPostsFetches?: string[];
    };
    const originalFetch = window.fetch.bind(window);

    windowWithTrackedFetches.__trackedPostsFetches = trackedFetches;

    window.fetch = async (...args) => {
      const [input] = args;
      const url = typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

      if (url.includes(postsPath)) {
        trackedFetches.push(url);

        if (trackedFetches.length === 1) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }

      return originalFetch(...args);
    };
  }, `/@${username}/posts`);
}

async function getTrackedPostsFetches(page: Page) {
  return page.evaluate(() => {
    const windowWithTrackedFetches = window as typeof window & {
      __trackedPostsFetches?: string[];
    };

    return [...(windowWithTrackedFetches.__trackedPostsFetches ?? [])];
  });
}

async function getPanelWidth(locator: Locator) {
  return locator.evaluate((element) => {
    return Math.round(element.getBoundingClientRect().width);
  });
}

async function getHandlePosition(handle: Locator) {
  const handleBox = await handle.boundingBox();

  if (!handleBox) {
    throw new Error("Resizable handle is not visible");
  }

  return {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2,
  };
}

async function dragHandleBy(page: Page, handle: Locator, deltaX: number) {
  const { x, y } = await getHandlePosition(handle);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, {
    steps: Math.max(16, Math.round(Math.abs(deltaX) / 20)),
  });
  await page.mouse.up();
}

async function dragHandlePath(page: Page, handle: Locator, path: number[]) {
  const { x, y } = await getHandlePosition(handle);

  await page.mouse.move(x, y);
  await page.mouse.down();

  for (const deltaX of path) {
    await page.mouse.move(x + deltaX, y, {
      steps: Math.max(16, Math.round(Math.abs(deltaX) / 20)),
    });
  }

  await page.mouse.up();
}

async function openDesktopArticle(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${username}/articles/${articleSlug}`);

  await expect(
    page.getByRole("heading", { name: articleTitle }),
  ).toBeVisible({ timeout: 10000 });
}

async function openDesktopProfileRoot(page: Page) {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@${username}`);

  await expect(
    page.getByRole("button", { name: "Show Artifacts" }),
  ).toBeVisible({ timeout: 10000 });
}

test.describe("Profile content panel toggle", () => {
  test("starts collapsed on the desktop profile root and opens posts from the toggle", async ({
    page,
  }) => {
    await openDesktopProfileRoot(page);

    const toggle = page.getByRole("button", { name: "Show Artifacts" });
    const contentRegion = page.getByTestId("desktop-content-panel");
    const resizablePanels = page.locator('[data-slot="resizable-panel"]');
    const contentResizablePanel = resizablePanels.nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');

    await expect(page).toHaveURL(new RegExp(`/@${username}(\\?.*)?$`));
    await expect(contentRegion).toHaveAttribute("data-state", "closed");
    await expect(handle).toBeVisible();
    await expect(toggle).toBeVisible();

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeLessThan(COLLAPSED_PANEL_MAX_WIDTH);

    await toggle.click();

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));
    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(
      page.getByRole("button", { name: "Hide Artifacts" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(handle).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Posts" }),
    ).toBeVisible({ timeout: 10000 });

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeGreaterThan(120);
  });

  test("double-clicking the collapsed toggle only starts one posts navigation", async ({
    page,
  }) => {
    await instrumentPostsFetches(page);
    await openDesktopProfileRoot(page);

    const toggle = page.getByRole("button", { name: "Show Artifacts" });
    const contentRegion = page.getByTestId("desktop-content-panel");

    await toggle.dblclick({ delay: 10 });

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));
    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(
      page.getByRole("button", { name: "Hide Artifacts" }),
    ).toBeVisible({ timeout: 5000 });

    await expect
      .poll(async () => (await getTrackedPostsFetches(page)).length)
      .toBe(1);
  });

  test("opens posts when dragging the collapsed root handle", async ({
    page,
  }) => {
    await openDesktopProfileRoot(page);

    const contentRegion = page.getByTestId("desktop-content-panel");
    const contentResizablePanel = page.locator('[data-slot="resizable-panel"]').nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');

    await expect(contentRegion).toHaveAttribute("data-state", "closed");

    await dragHandleBy(page, handle, REOPEN_DELTA_X);

    await expect(page).toHaveURL(new RegExp(`/@${username}/posts(\\?.*)?$`));
    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(
      page.getByRole("button", { name: "Hide Artifacts" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(handle).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Posts" }),
    ).toBeVisible({ timeout: 10000 });

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeGreaterThan(120);
  });

  test("closes and reopens to a 50/50 layout from the desktop toggle", async ({
    page,
  }) => {
    await openDesktopArticle(page);

    const toggle = page.getByRole("button", { name: "Hide Artifacts" });
    const contentRegion = page.getByTestId("desktop-content-panel");
    const resizablePanels = page.locator('[data-slot="resizable-panel"]');
    const contentResizablePanel = resizablePanels.nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');

    await expect(contentRegion).toHaveAttribute("data-state", "open");

    const initialContentWidth = await getPanelWidth(contentResizablePanel);
    await dragHandleBy(page, handle, 220);

    await expect
      .poll(async () => {
        const currentWidth = await getPanelWidth(contentResizablePanel);
        return Math.abs(currentWidth - initialContentWidth);
      })
      .toBeGreaterThan(120);

    await toggle.click();

    const reopenToggle = page.getByRole("button", { name: "Show Artifacts" });
    await expect(reopenToggle).toBeVisible({ timeout: 5000 });
    await expect(contentRegion).toHaveAttribute("data-state", "closed");
    await expect(handle).toBeVisible();

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeLessThan(COLLAPSED_PANEL_MAX_WIDTH);

    await expect(page).toHaveURL(
      new RegExp(`/@${username}/articles/${articleSlug}(\\?.*)?$`),
    );

    await reopenToggle.click();

    await expect(toggle).toBeVisible({ timeout: 5000 });
    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(handle).toBeVisible();
    await expect(
      page.getByRole("heading", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });

    await expect
      .poll(async () => {
        const currentWidth = await getPanelWidth(contentResizablePanel);
        return Math.abs(currentWidth - initialContentWidth);
      })
      .toBeLessThan(80);
  });

  test("recovers when the drag reverses after reaching collapsed width", async ({
    page,
  }) => {
    await openDesktopArticle(page);

    const toggle = page.getByRole("button", { name: "Hide Artifacts" });
    const contentRegion = page.getByTestId("desktop-content-panel");
    const resizablePanels = page.locator('[data-slot="resizable-panel"]');
    const contentResizablePanel = resizablePanels.nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');

    await dragHandlePath(page, handle, [COLLAPSE_DELTA_X, REVERSE_DELTA_X]);

    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(toggle).toBeVisible();
    await expect(handle).toBeVisible();

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeGreaterThan(120);
    await expect(
      page.getByRole("heading", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("reopens to 50/50 after a released drag collapse", async ({ page }) => {
    await openDesktopArticle(page);

    const toggle = page.getByRole("button", { name: "Hide Artifacts" });
    const contentRegion = page.getByTestId("desktop-content-panel");
    const resizablePanels = page.locator('[data-slot="resizable-panel"]');
    const contentResizablePanel = resizablePanels.nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');
    const initialContentWidth = await getPanelWidth(contentResizablePanel);

    await dragHandleBy(page, handle, COLLAPSE_DELTA_X);

    const reopenToggle = page.getByRole("button", { name: "Show Artifacts" });
    await expect(contentRegion).toHaveAttribute("data-state", "closed");
    await expect(reopenToggle).toBeVisible({ timeout: 5000 });
    await expect(handle).toBeVisible();

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeLessThan(COLLAPSED_PANEL_MAX_WIDTH);

    await reopenToggle.click();

    await expect(toggle).toBeVisible({ timeout: 5000 });
    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(handle).toBeVisible();

    await expect
      .poll(async () => {
        const currentWidth = await getPanelWidth(contentResizablePanel);
        return Math.abs(currentWidth - initialContentWidth);
      })
      .toBeLessThan(80);
  });

  test("can drag reopen from a fully collapsed state", async ({ page }) => {
    await openDesktopArticle(page);

    const contentRegion = page.getByTestId("desktop-content-panel");
    const resizablePanels = page.locator('[data-slot="resizable-panel"]');
    const contentResizablePanel = resizablePanels.nth(1);
    const handle = page.locator('[data-slot="resizable-handle"]');

    await dragHandleBy(page, handle, COLLAPSE_DELTA_X);

    await expect(contentRegion).toHaveAttribute("data-state", "closed");
    await expect(handle).toBeVisible();

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeLessThan(COLLAPSED_PANEL_MAX_WIDTH);

    await dragHandleBy(page, handle, REOPEN_DELTA_X);

    await expect(contentRegion).toHaveAttribute("data-state", "open");
    await expect(
      page.getByRole("button", { name: "Hide Artifacts" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(handle).toBeVisible();
    await expect(
      page.getByRole("heading", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });

    await expect
      .poll(async () => await getPanelWidth(contentResizablePanel))
      .toBeGreaterThan(120);
  });

  test("keeps the mobile drawer behavior unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/@${username}/articles`);

    await expect(
      page.getByRole("button", { name: /Hide Artifacts|Show Artifacts/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Articles" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("link", { name: articleTitle }),
    ).toBeVisible({ timeout: 10000 });
  });
});
