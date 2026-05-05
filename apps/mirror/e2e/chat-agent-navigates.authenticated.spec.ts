import { expect, test, type Page } from "@playwright/test";
import {
  RECEIVED_BUBBLE_SELECTOR,
  openChat,
  sendChatMessage,
} from "./helpers/chat";

/**
 * End-to-end proof of the agent-UI parity loop (Wave 3).
 *
 * Pipeline under test:
 *   1. Visitor opens `/@rick-rubin?chat=1` and sends a prompt that asks for
 *      the latest article.
 *   2. Clone agent calls `getLatestPublished({ kind: "articles" })` →
 *      Convex internal query returns the latest published row's slug.
 *   3. Agent calls `navigateToContent({ kind: "articles", slug })` →
 *      Convex internal query resolves the row, builds the canonical
 *      `/@<username>/articles/<slug>` href via `buildContentHref` and
 *      returns it as a tool result.
 *   4. The streamed UIMessage carries a `tool-navigateToContent` part with
 *      `state === "output-available"` and the structured `href` payload.
 *   5. `useAgentIntentWatcher` (mounted inside `ChatActiveThread`) reads
 *      that part, dispatches through `useCloneActions().navigateToContent`,
 *      and the dispatcher calls `router.push(buildChatAwareHref(href))`.
 *   6. The article-detail route renders.
 *
 * This spec exercises the full loop against the real Anthropic-backed
 * `cloneAgent` — there is no LLM mock. The agent in `chat/agent.ts` plus the
 * `TOOLS_VOCABULARY` block in the system prompt teach it that the tool
 * exists, so a "show me your latest article" prompt reliably triggers the
 * tool-call sequence in practice. Generous timeouts (30-60s) accommodate
 * cold-start LLM latency and tool-execution round-trips.
 *
 * Cross-user negative path: when the agent is asked about a *different*
 * user's content, the tool's `resolveBySlug` cannot find a match scoped to
 * the current `profileOwnerId` (rick-rubin's id), so it returns `null` and
 * the tool throws. The LLM falls back to text. We assert the URL never
 * pivots to a foreign profile — this is the user-visible mirror of the
 * cross-user isolation invariant the unit tests in
 * `packages/convex/convex/chat/__tests__/tools.test.ts` already pin.
 *
 * The filename ends in `.authenticated.spec.ts` so Playwright loads the
 * `e2e/.auth/user.json` storage state. The visitor still chats with
 * rick-rubin's clone (not their own) — the auth state just keeps the
 * session-tracking surface consistent with future-state tests that need it
 * for daily-bucket plumbing, mirroring the `bio-rag-*.authenticated.spec.ts`
 * convention.
 */

const username = "rick-rubin";
const positivePrompt = "show me your latest article.";
const negativePrompt = "show me Bob's latest article.";

// Agent → tool result → router.push round-trip is multi-hop. Allow up to
// 60s end-to-end so a cold-start Anthropic call doesn't flake the assertion.
const NAVIGATION_TIMEOUT = 60_000;

// One real LLM call per test, run them serially so we don't hit Anthropic's
// per-key concurrency cap and make flakier replies on the negative path.
//
// Describe timeout is 150s — two sequential `waitFor`s each up to
// `NAVIGATION_TIMEOUT` (60s) plus the chat-open + send overhead leave
// little headroom at 120s on a cold-start LLM run. 150s gives ~30s of
// slack without being so loose that a stuck stream hangs the suite.
test.describe.configure({ mode: "serial", timeout: 150_000 });

async function captureInitialUrl(page: Page): Promise<string> {
  // Read after the chat panel mounts so the `?chat=1` (and possibly
  // `?conversation=`) params are baked into the captured URL.
  return page.url();
}

test.describe("Clone agent navigates the visitor via the navigateToContent tool", () => {
  test("positive path: 'show me your latest article' opens the article detail view", async ({
    page,
  }) => {
    const textarea = await openChat(page, username);

    await sendChatMessage(textarea, positivePrompt);
    // Confirm the user's message landed before waiting on the agent reply
    // and the tool-driven navigation.
    await expect(page.getByText(positivePrompt)).toBeVisible();

    // The tool-result watcher fires `router.push` once the agent emits a
    // `tool-navigateToContent` part with `state === "output-available"`.
    // The URL transition is the load-bearing assertion — the user sees the
    // panel change because the URL changed, not because the chat said so.
    await page.waitForURL(
      new RegExp(`/@${username}/articles/[^/?#]+`),
      { timeout: NAVIGATION_TIMEOUT },
    );

    // Same shape `chat-plain-text.spec.ts` proves: the article detail
    // renders an `<h1>` with the title, and `?chat=1` is preserved by
    // `buildChatAwareHref`. Use the H1 heading as a stable anchor for
    // "the article-detail component is visible" — the loading sibling has
    // a `data-testid="article-detail-loading"` that disappears when the
    // detail finishes hydrating.
    await expect(page.locator("article h1").first()).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });
    expect(page.url()).toContain("/articles/");
    // `buildChatAwareHref` must preserve BOTH chat query params through the
    // agent-driven navigation — `?chat=1` keeps the chat panel open, and
    // `?conversation=...` pins this thread so a refresh doesn't lose it.
    // Match the `[?&]conversation=` shape that `chat-assistant-placeholder.spec.ts`
    // already relies on.
    expect(page.url()).toMatch(/[?&]chat=1\b/);
    expect(page.url()).toMatch(/[?&]conversation=[^&]+/);
  });

  test("negative path: 'show me Bob's latest article' does not navigate to a foreign profile", async ({
    page,
  }) => {
    const textarea = await openChat(page, username);
    const startingUrl = await captureInitialUrl(page);

    await sendChatMessage(textarea, negativePrompt);
    await expect(page.getByText(negativePrompt)).toBeVisible();

    // We deliberately do NOT assert the agent's reply text — the LLM may
    // word the fallback any number of ways. The structural assertion is:
    //
    //   1. The URL never pivots to a different `/@<username>/...` path.
    //      `resolveBySlug({ userId: rickRubin, slug: <bob's slug> })` is
    //      `null` by construction (cross-user index pin), the tool throws,
    //      the LLM recovers with text, and `useAgentIntentWatcher` never
    //      sees an `output-available` tool result for the wrong user.
    //   2. The page is still on rick-rubin's profile when the textarea
    //      re-enables (i.e. the stream completed).
    //
    // Wait for the streaming round-trip to finish before sampling the URL —
    // textarea-enabled is the same signal `chat-plain-text.spec.ts` uses
    // for "stream complete."
    await expect(textarea).toBeEnabled({ timeout: NAVIGATION_TIMEOUT });

    // Prove the LLM actually replied — without this, "URL didn't change"
    // could mean either (a) the tool was called and `resolveBySlug` blocked
    // the cross-user navigation, or (b) the agent never tried at all. The
    // received-bubble assertion combined with the URL-unchanged check
    // triangulates the intended outcome: the agent responded *and* did not
    // navigate. Selector matches the peer chat specs (see
    // `helpers/chat.ts:RECEIVED_BUBBLE_SELECTOR`).
    await expect(page.locator(RECEIVED_BUBBLE_SELECTOR).last()).toBeVisible({
      timeout: NAVIGATION_TIMEOUT,
    });

    const finalUrl = page.url();
    // Always still under rick-rubin's profile.
    expect(finalUrl).toMatch(new RegExp(`/@${username}(?:/|\\?|$)`));
    // Never under any OTHER `@username` path.
    expect(finalUrl).not.toMatch(/\/@(?!rick-rubin\b)[^/?#]+/);

    // Path component must not have moved into an articles/posts detail —
    // we don't care about query-string changes (Next.js may rewrite
    // `?chat=1&conversation=...` mid-stream as the conversation row is
    // created); the path is what would change on a successful navigation.
    const stripQuery = (u: string) => u.split("?")[0];
    expect(stripQuery(finalUrl)).toBe(stripQuery(startingUrl));
  });
});
