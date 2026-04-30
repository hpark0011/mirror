import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  RECEIVED_BUBBLE_SELECTOR,
  openChat,
  sendChatMessage,
} from "./helpers/chat";

const username = "rick-rubin";

const promptsThatHistoricallyTriggeredMarkdown = [
  "Can you control ui?",
  "can you navigate to your latest post?",
  "What kinds of things do you write about?",
] as const;

async function waitForReplyAndRead(
  page: Page,
  textarea: Locator,
): Promise<string> {
  const receivedBubbles = page.locator(RECEIVED_BUBBLE_SELECTOR);

  // Each test opens a fresh chat, so the new reply is the only received
  // bubble. Wait for exactly one to render and the stream to finish (textarea
  // re-enables once streaming completes).
  await expect
    .poll(async () => receivedBubbles.count(), { timeout: 30000 })
    .toBe(1);
  await expect(textarea).toBeEnabled({ timeout: 30000 });

  const text = (await receivedBubbles.last().textContent()) ?? "";
  return text.trim();
}

function assertNoMarkdown(reply: string, prompt: string) {
  const ctx = `reply to "${prompt}"`;

  expect(reply, `${ctx} should not be empty`).not.toBe("");
  expect(reply, `${ctx} should not contain ** (markdown bold)`).not.toContain(
    "**",
  );
  expect(
    reply,
    `${ctx} should not contain bullet list lines (- or * prefix)`,
  ).not.toMatch(/(^|\n)\s*[-*]\s+/);
  expect(
    reply,
    `${ctx} should not contain markdown headings (# prefix)`,
  ).not.toMatch(/(^|\n)#+\s+/);
  // Match a backtick-enclosed code span (e.g. `command`), not stray
  // backticks. A reply that quotes an album title with backticks is allowed;
  // a code-formatting span is not.
  expect(
    reply,
    `${ctx} should not contain markdown code spans (\`...\`)`,
  ).not.toMatch(/`[^`]+`/);
}

// Run serially: each test makes a live LLM call, and Playwright's default
// fullyParallel=true otherwise fires three concurrent streams against the
// same Convex deployment, which causes textarea-still-disabled timeouts
// under provider concurrency limits.
//
// Each test does a fresh openChat + send + wait for a streamed LLM reply.
// Playwright's default 30s test timeout is too tight for that pipeline on
// slow-LLM days; bump it for this describe only.
test.describe.configure({ mode: "serial", timeout: 90000 });

test.describe("Clone chat replies are plain text (no markdown)", () => {
  for (const prompt of promptsThatHistoricallyTriggeredMarkdown) {
    test(`agent replies in plain prose for: "${prompt}"`, async ({ page }) => {
      const textarea = await openChat(page, username);

      await sendChatMessage(textarea, prompt);

      // Confirm the user's message landed before waiting for the assistant.
      await expect(page.getByText(prompt)).toBeVisible();

      const reply = await waitForReplyAndRead(page, textarea);

      // Surface the actual reply in the test output so a maintainer can read
      // what the model said when reviewing the run.
      console.log(`[chat-plain-text] prompt: "${prompt}"`);
      console.log(`[chat-plain-text] reply: ${reply}`);

      assertNoMarkdown(reply, prompt);
    });
  }
});
