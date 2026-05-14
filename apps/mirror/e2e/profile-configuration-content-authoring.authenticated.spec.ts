import { expect, type Locator, type Page } from "@playwright/test";
import { test, waitForAuthReady } from "./fixtures/auth";
import { RECEIVED_BUBBLE_SELECTOR, sendChatMessage } from "./helpers/chat";

/**
 * End-to-end proof of the configuration agent's content-authoring loop
 * (PLAN_013).
 *
 * Pipeline under test:
 *   1. Owner clicks "Configure profile" on `/@test-user` → URL flips to
 *      `?chat=1&chatMode=configuration` and the configuration helper
 *      textarea opens.
 *   2. Owner asks the helper to create a new draft post with a unique
 *      title. The configuration agent calls `applyContentPatch` →
 *      `createPostForUser` inserts a draft row → `useAgentIntentWatcher`
 *      reads the `tool-applyContentPatch` part and dispatches
 *      `navigateToContent` to the server-built `editHref`.
 *   3. The owner lands on `/@test-user/posts/<slug>/edit?…` with the
 *      generated title visible in the editor.
 *   4. Owner asks the helper to rename the post (title-only update,
 *      preserving the slug). The agent calls `applyContentPatch` with
 *      an `update` op; the editor route stays put and the title input
 *      reflects the new value — proving the update path round-trips
 *      through the same tool surface and the same dispatcher.
 *   5. Owner asks the helper to delete the post. The agent calls
 *      `applyContentPatch({ delete })`, the watcher dispatches
 *      `navigateToProfileSection` to the posts list, and the deleted
 *      post is absent from the list.
 *   6. Owner asks the helper to create an article — the same path is
 *      exercised for the articles table to prove both content kinds use
 *      one tool surface.
 *
 * This spec relies on the real Anthropic-backed `cloneAgent` (no LLM
 * mock), so timeouts are generous to accommodate cold-start latency.
 * One owner per test run, conversations isolated by URL params so the
 * tests don't share a thread.
 */

// Multi-hop tool-call → mutation → router.push round-trips through real
// Anthropic. 90s per-step covers cold starts + chain-of-thought overhead.
const AGENT_STEP_TIMEOUT = 90_000;
// Three sequential agent flows (create + update + delete) plus chat-open
// overhead. Each step can independently spend the per-step timeout, so
// the describe ceiling needs headroom over `3 * AGENT_STEP_TIMEOUT`.
test.describe.configure({ mode: "serial", timeout: 360_000 });

const username = "test-user";

// Slugs and titles are unique per spec run to avoid collisions when the
// suite is re-run against the same dev backend. Convex's slug normalizer
// drops non-ASCII and lowercases; we feed it title text the agent can
// echo back verbatim.
function uniqueTitle(prefix: string): { title: string; slug: string } {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const title = `${prefix} ${stamp}`;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { title, slug };
}

async function openConfigurationHelper(page: Page): Promise<Locator> {
  await page.goto(`/@${username}`);
  await waitForAuthReady(page);
  await page.getByRole("button", { name: "Configure profile" }).click();
  await expect(page).toHaveURL(/[?&]chatMode=configuration\b/);
  const textarea = page.getByPlaceholder(
    "Paste a resume, LinkedIn URL, or profile update...",
  );
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  return textarea;
}

async function waitForAgentReply(page: Page): Promise<void> {
  const bubble = page.locator(RECEIVED_BUBBLE_SELECTOR).last();
  await expect(bubble).toBeVisible({ timeout: AGENT_STEP_TIMEOUT });
  await expect(bubble).toHaveText(/\S+/, { timeout: AGENT_STEP_TIMEOUT });
}

test.describe("Configuration agent content authoring", () => {
  test("owner creates, updates, and deletes a draft post via applyContentPatch", async ({
    authenticatedPage: page,
  }) => {
    const { title, slug } = uniqueTitle("Agent Draft Post");
    const renamedTitle = `${title} (Renamed)`;

    const textarea = await openConfigurationHelper(page);

    // Step 1: create a draft post with an explicit title.
    await sendChatMessage(
      textarea,
      `Please create a new draft post titled "${title}". Use the category Notes and write a single paragraph saying "An agent-authored draft."`,
    );

    // Wait for the tool round-trip to dispatch a navigation to the editor.
    await page.waitForURL(
      new RegExp(`/@${username}/posts/${slug}/edit\\b`),
      { timeout: AGENT_STEP_TIMEOUT },
    );
    expect(page.url()).toMatch(/[?&]chat=1\b/);
    expect(page.url()).toMatch(/[?&]chatMode=configuration\b/);
    expect(page.url()).toMatch(/[?&]conversation=[^&]+/);

    // Editor title input is the canonical mount point for the post-edit
    // route; the agent-generated title must round-trip through Convex
    // → editor without mutation. The post-editor metadata header carries
    // a `data-testid="post-title-input"` attribute we can pin against.
    const titleInput = page.getByTestId("post-title-input");
    await expect(titleInput).toHaveValue(title, {
      timeout: AGENT_STEP_TIMEOUT,
    });

    await waitForAgentReply(page);

    // Step 2: update the post title via the same agent. The slug stays
    // unchanged (the prompt requires the agent to preserve slugs unless
    // explicitly asked to rename), so the editor URL is unchanged and
    // the title input value reflects the new title.
    await sendChatMessage(
      textarea,
      `Actually, please rename that draft to "${renamedTitle}" — keep the slug as it is and leave the body alone.`,
    );

    // Editor route should not change because the slug is preserved.
    await expect(page).toHaveURL(
      new RegExp(`/@${username}/posts/${slug}/edit\\b`),
      { timeout: AGENT_STEP_TIMEOUT },
    );
    await expect(titleInput).toHaveValue(renamedTitle, {
      timeout: AGENT_STEP_TIMEOUT,
    });

    await waitForAgentReply(page);

    // Step 3: delete the post via the same agent.
    await sendChatMessage(
      textarea,
      `Please delete the post "${renamedTitle}" — yes, I'm confirming the deletion.`,
    );

    await page.waitForURL(new RegExp(`/@${username}/posts(?:\\?|$)`), {
      timeout: AGENT_STEP_TIMEOUT,
    });
    // The deleted post must be absent from the owner's list.
    await expect(page.getByText(renamedTitle, { exact: false })).toHaveCount(
      0,
      { timeout: AGENT_STEP_TIMEOUT },
    );

    await waitForAgentReply(page);
  });

  test("owner creates a draft article via the same tool path", async ({
    authenticatedPage: page,
  }) => {
    const { title, slug } = uniqueTitle("Agent Draft Article");

    const textarea = await openConfigurationHelper(page);

    await sendChatMessage(
      textarea,
      `Please create a new draft article titled "${title}". Use the category Essays and write a single paragraph saying "An agent-authored draft article."`,
    );

    await page.waitForURL(
      new RegExp(`/@${username}/articles/${slug}/edit\\b`),
      { timeout: AGENT_STEP_TIMEOUT },
    );

    // Mirror of the post-editor assertion; the article editor's metadata
    // header carries `data-testid="article-title-input"`.
    const titleInput = page.getByTestId("article-title-input");
    await expect(titleInput).toHaveValue(title, {
      timeout: AGENT_STEP_TIMEOUT,
    });
  });
});
