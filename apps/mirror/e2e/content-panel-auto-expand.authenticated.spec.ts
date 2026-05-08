import { expect, test, type Locator, type Page } from "@playwright/test";
import { openChat, sendChatMessage } from "./helpers/chat";

/**
 * PLAN_010 — content panel auto-expand on dispatcher navigate (agent path).
 *
 * The load-bearing assertion behind the parity-gap fix: when a visitor manually
 * collapses the content panel mid-conversation and the agent calls
 * `navigateToContent({ kind, slug, href })`, the dispatcher's
 * `ensureContentPanelOpen()` re-opens the panel before `router.push` so the
 * chat's "Just opened it on the right" wording matches reality.
 *
 * Why drag-to-collapse (not the "Hide Artifacts" toggle): when chat is open,
 * the interaction panel renders `ChatPanel`, which replaces `ProfilePanel`
 * (where the toggle lives). The resize handle remains reachable in either
 * mode, so it is the only way to repro the "panel collapsed while chat is
 * open" state without doing a hard navigation that would reset client state.
 *
 * Mirrors `chat-agent-navigates.authenticated.spec.ts`'s pattern: serial
 * mode, 150s describe timeout, 60s navigation timeout — the agent → tool
 * result → router.push round-trip can take 30-60s on a cold start.
 */

const username = "rick-rubin";
const NAV_TIMEOUT = 60_000;

test.describe.configure({ mode: "serial", timeout: 150_000 });

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
  // react-resizable-panels can miss the synthetic pointerup at the
  // collapse boundary; a follow-up no-button move + up clears the stuck
  // drag state. Same recovery pattern as `profile-content-panel-toggle.spec.ts`.
  await page.mouse.move(10, 10);
  await page.mouse.up();
}

test.describe("Content panel auto-expand — agent path (PLAN_010)", () => {
  test("agent navigation while the content panel is collapsed re-opens it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    const textarea = await openChat(page, username);

    const contentRegion = page.getByTestId("desktop-content-panel");
    await expect(contentRegion).toHaveAttribute("data-state", "open", {
      timeout: 10_000,
    });

    // Drag the resize handle far enough right to cross the collapse
    // boundary. 900px is what `profile-content-panel-toggle.spec.ts`'s
    // COLLAPSE_DELTA_X uses on a 1440px viewport.
    const handle = page.locator('[data-slot="resizable-handle"]');
    await dragHandleBy(page, handle, 900);

    await expect(contentRegion).toHaveAttribute("data-state", "closed", {
      timeout: 5_000,
    });

    await sendChatMessage(textarea, "show me your latest article.");

    // The agent calls getLatestPublished → navigateToContent. The watcher
    // dispatches via useCloneActions().navigateToContent. PLAN_010's bridge
    // fires inside the dispatcher, before router.push.
    await page.waitForURL(
      new RegExp(`/@${username}/articles/[^/?#]+`),
      { timeout: NAV_TIMEOUT },
    );

    // Load-bearing assertion: the panel is open after the agent navigates.
    await expect(contentRegion).toHaveAttribute("data-state", "open", {
      timeout: 10_000,
    });
    await expect(page.locator("article h1").first()).toBeVisible({
      timeout: NAV_TIMEOUT,
    });
    expect(page.url()).toMatch(/[?&]chat=1\b/);
    expect(page.url()).toMatch(/[?&]conversation=[^&]+/);
  });
});
