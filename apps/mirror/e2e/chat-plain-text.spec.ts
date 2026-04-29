import { expect, test, type Locator, type Page } from "@playwright/test";

const username = "rick-rubin";

const promptsThatHistoricallyTriggeredMarkdown = [
  "Can you control ui?",
  "can you navigate to your latest post?",
  "What kinds of things do you write about?",
];

async function openChat(page: Page) {
  await page.goto(`/@${username}?chat=1`);

  const textarea = page.locator('textarea[placeholder^="Message "]');
  await expect(textarea).toBeVisible({ timeout: 10000 });

  return textarea;
}

async function sendChatMessage(textarea: Locator, message: string) {
  await textarea.fill(message);
  await textarea.press("Enter");
}

async function waitForReplyAndRead(
  page: Page,
  textarea: Locator,
  expectedReceivedCount: number,
): Promise<string> {
  const receivedBubbles = page.locator(
    '[data-slot="chat-message"][data-variant="received"] [data-slot="chat-message-bubble"]',
  );

  // Wait for the new received bubble to render and the reply to finish
  // streaming (textarea re-enables once the stream completes).
  await expect.poll(
    async () => receivedBubbles.count(),
    { timeout: 30000 },
  ).toBeGreaterThanOrEqual(expectedReceivedCount);
  await expect(textarea).toBeEnabled({ timeout: 30000 });

  const text = (await receivedBubbles.last().textContent()) ?? "";
  return text.trim();
}

function assertNoMarkdown(reply: string, prompt: string) {
  expect(reply, `reply to "${prompt}" should not be empty`).not.toBe("");

  expect(
    reply.includes("**"),
    `reply to "${prompt}" should not contain ** (markdown bold). Got: ${reply}`,
  ).toBe(false);

  expect(
    /(^|\n)\s*[-*]\s+/.test(reply),
    `reply to "${prompt}" should not contain bullet list lines (- or * prefix). Got: ${reply}`,
  ).toBe(false);

  expect(
    /(^|\n)#+\s+/.test(reply),
    `reply to "${prompt}" should not contain markdown headings (# prefix). Got: ${reply}`,
  ).toBe(false);

  expect(
    reply.includes("`"),
    `reply to "${prompt}" should not contain backticks (code formatting). Got: ${reply}`,
  ).toBe(false);
}

test.describe("Clone chat replies are plain text (no markdown)", () => {
  test("agent replies in conversational prose, not markdown", async ({
    page,
  }) => {
    const textarea = await openChat(page);

    let expectedReceivedCount = 0;

    for (const prompt of promptsThatHistoricallyTriggeredMarkdown) {
      expectedReceivedCount += 1;
      await sendChatMessage(textarea, prompt);

      // Confirm the user's message landed before waiting for the assistant.
      await expect(page.getByText(prompt)).toBeVisible();

      const reply = await waitForReplyAndRead(
        page,
        textarea,
        expectedReceivedCount,
      );

      // Surface the actual reply in the test output so a maintainer can read
      // what the model said when reviewing the run.
      console.log(`[chat-plain-text] prompt: "${prompt}"`);
      console.log(`[chat-plain-text] reply: ${reply}`);

      assertNoMarkdown(reply, prompt);
    }
  });
});
