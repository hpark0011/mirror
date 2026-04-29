import { expect, type Locator, type Page } from "@playwright/test";

export async function openChat(page: Page, username: string): Promise<Locator> {
  await page.goto(`/@${username}?chat=1`);

  const textarea = page.locator('textarea[placeholder^="Message "]');
  await expect(textarea).toBeVisible({ timeout: 10000 });

  return textarea;
}

export async function sendChatMessage(
  textarea: Locator,
  message: string,
): Promise<void> {
  await textarea.fill(message);
  await textarea.press("Enter");
}

export const RECEIVED_BUBBLE_SELECTOR =
  '[data-slot="chat-message"][data-variant="received"] [data-slot="chat-message-bubble"]';
