import { expect, test, type Page } from "@playwright/test";
import {
  RECEIVED_BUBBLE_SELECTOR,
  openChat,
  sendChatMessage,
} from "../helpers/chat";

/**
 * End-to-end proof that the clone agent can pull up the Bio tab through
 * the `openBio` tool — the parity counterpart to
 * `chat-agent-navigates.authenticated.spec.ts` for slug-less profile-tab
 * navigation.
 *
 * Pipeline under test:
 *   1. Visitor opens `/@rick-rubin?chat=1` and asks for the bio.
 *   2. Clone agent calls `openBio()` (no args) → Convex internal query
 *      `resolveBioForOwner({userId: rickRubin})` confirms ≥1 bio entry
 *      exists, returns `{kind: "bio", href: "/@rick-rubin/bio"}`.
 *   3. The streamed UIMessage carries a `tool-openBio` part with
 *      `state === "output-available"`.
 *   4. `useAgentIntentWatcher` dispatches through
 *      `useCloneActions().navigateToBio({href})`, which `router.push`'s
 *      `buildChatAwareHref(href)`.
 *   5. The Bio panel renders (`data-testid="bio-panel"` becomes visible).
 *
 * Cross-user negative path: asking about a *different* user's background
 * keeps the URL on rick-rubin's profile (the agent has no cross-user
 * verb). Mirrors the `'show me Bob's latest article'` case.
 *
 * Pre-flight: `pnpm --filter=@feel-good/convex seed:rick-rubin` must run
 * before this spec (it provisions rick-rubin's user row + posts + articles
 * + bio entries). Playwright's `webServer` only starts the Mirror dev
 * server (`playwright.config.ts:41-45`), not Convex seeding, so the
 * verification block below makes the seed an explicit pre-step.
 */

const username = "rick-rubin";
const positivePrompt = "can you show me your bio?";
const negativePrompt = "show me Bob's bio.";
const NAVIGATION_TIMEOUT = 60_000;

test.describe.configure({ mode: "serial", timeout: 150_000 });

async function captureInitialUrl(page: Page): Promise<string> {
  return page.url();
}

test.describe("Clone agent pulls up the Bio tab via the openBio tool", () => {
  test("positive path: 'can you show me your bio' navigates to /@<owner>/bio with seeded entries", async ({
    page,
  }) => {
    const textarea = await openChat(page, username);
    await sendChatMessage(textarea, positivePrompt);
    await expect(page.getByText(positivePrompt)).toBeVisible();

    // URL transition is the load-bearing assertion — the user sees the
    // Bio panel because the URL changed, not because chat said so.
    await page.waitForURL(new RegExp(`/@${username}/bio(?:[?#]|$)`), {
      timeout: NAVIGATION_TIMEOUT,
    });

    // Bio panel mounts AND a seeded entry is rendered. The panel-mount
    // selector alone could pass on an empty panel; pinning a literal seeded
    // title proves the seed ran AND the entry list rendered through the
    // dispatcher's `router.push`. "Producer at Def Jam" comes from
    // `ensureRickRubinBioEntries` in `packages/convex/convex/seed.ts`.
    await expect(page.getByTestId("bio-panel")).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });
    await expect(
      page.getByTestId("bio-entry-card").filter({ hasText: "Producer at Def Jam" }),
    ).toBeVisible({ timeout: NAVIGATION_TIMEOUT });

    // Chat-aware-href preservation: both `?chat=1` and `?conversation=`
    // survive the agent-driven navigation (matches the article-side spec).
    expect(page.url()).toMatch(/[?&]chat=1\b/);
    expect(page.url()).toMatch(/[?&]conversation=[^&]+/);
  });

  test("negative path: cross-user bio request does not pivot the URL", async ({
    page,
  }) => {
    const textarea = await openChat(page, username);
    const startingUrl = await captureInitialUrl(page);

    await sendChatMessage(textarea, negativePrompt);
    await expect(page.getByText(negativePrompt)).toBeVisible();
    await expect(textarea).toBeEnabled({ timeout: NAVIGATION_TIMEOUT });
    await expect(page.locator(RECEIVED_BUBBLE_SELECTOR).last()).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });

    const finalUrl = page.url();
    // Always still under rick-rubin's profile.
    expect(finalUrl).toMatch(new RegExp(`/@${username}(?:/|\\?|$)`));
    // Never pivoted to any OTHER `/@username/...` path.
    expect(finalUrl).not.toMatch(/\/@(?!rick-rubin\b)[^/?#]+/);

    // Path component must not have moved into the Bio panel either —
    // the agent has no `openBio({user: B})` verb (and shouldn't).
    const stripQuery = (u: string) => u.split("?")[0];
    expect(stripQuery(finalUrl)).toBe(stripQuery(startingUrl));
  });
});
