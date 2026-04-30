import { expect, test, type Page } from "@playwright/test";
import { openChat, sendChatMessage } from "./helpers/chat";

const username = "rick-rubin";
const firstMessage = "Reply with exactly: ok";
const secondMessage = "Reply with exactly: hi";
const longReplyMessage =
  "Reply with exactly 80 numbered lines in plain text. Each line must begin with 'stream line' followed by the line number. No intro or outro.";
const detachedReplyMessage =
  "Reply with exactly 80 numbered lines in plain text. Each line must begin with 'detached line' followed by the line number. No intro or outro.";

type ScrollMetrics = {
  clientHeight: number;
  distanceFromBottom: number;
  scrollHeight: number;
  scrollTop: number;
};

async function installChatStateTracking(page: Page) {
  await page.addInitScript(() => {
    const trackedWindow = window as typeof window & {
      __pendingAssistantSeen?: boolean;
      __chatLoadingStateSeen?: boolean;
      __assistantTextSeen?: boolean;
      __pendingAssistantDroppedBeforeText?: boolean;
      __blankAssistantSeen?: boolean;
    };
    const pendingAssistantSelector = '[data-pending-assistant="true"]';
    const loadingStateSelector = '[data-slot="chat-message-loading-state"]';
    const blankAssistantSelector =
      '[data-assistant-empty="true"]:not([data-pending-assistant="true"])';
    const receivedBubbleSelector =
      '[data-slot="chat-message"][data-variant="received"] [data-slot="chat-message-bubble"]';

    trackedWindow.__pendingAssistantSeen = false;
    trackedWindow.__chatLoadingStateSeen = false;
    trackedWindow.__assistantTextSeen = false;
    trackedWindow.__pendingAssistantDroppedBeforeText = false;
    trackedWindow.__blankAssistantSeen = false;

    const markFlags = () => {
      const hasPendingAssistant = document.querySelector(pendingAssistantSelector)
        !== null;
      const hasAssistantText = Array.from(
        document.querySelectorAll(receivedBubbleSelector),
      ).some((element) => (element.textContent ?? "").trim().length > 0);

      if (hasPendingAssistant) {
        trackedWindow.__pendingAssistantSeen = true;
      }

      if (hasAssistantText) {
        trackedWindow.__assistantTextSeen = true;
      }

      if (
        trackedWindow.__pendingAssistantSeen
        && !trackedWindow.__assistantTextSeen
        && !hasPendingAssistant
      ) {
        trackedWindow.__pendingAssistantDroppedBeforeText = true;
      }

      if (document.querySelector(loadingStateSelector)) {
        trackedWindow.__chatLoadingStateSeen = true;
      }

      if (document.querySelector(blankAssistantSelector)) {
        trackedWindow.__blankAssistantSeen = true;
      }
    };

    const startObserver = () => {
      markFlags();

      const observer = new MutationObserver(() => {
        markFlags();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: [
          "data-assistant-empty",
          "data-pending-assistant",
          "data-slot",
          "data-variant",
        ],
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver, {
        once: true,
      });
    } else {
      startObserver();
    }
  });
}

async function resetChatStateTracking(page: Page) {
  await page.evaluate(() => {
    const trackedWindow = window as typeof window & {
      __pendingAssistantSeen?: boolean;
      __chatLoadingStateSeen?: boolean;
      __assistantTextSeen?: boolean;
      __pendingAssistantDroppedBeforeText?: boolean;
      __blankAssistantSeen?: boolean;
    };

    trackedWindow.__pendingAssistantSeen = false;
    trackedWindow.__chatLoadingStateSeen = false;
    trackedWindow.__assistantTextSeen = false;
    trackedWindow.__pendingAssistantDroppedBeforeText = false;
    trackedWindow.__blankAssistantSeen = false;
  });
}

async function getChatStateTracking(page: Page) {
  return page.evaluate(() => {
    const trackedWindow = window as typeof window & {
      __pendingAssistantSeen?: boolean;
      __chatLoadingStateSeen?: boolean;
      __assistantTextSeen?: boolean;
      __pendingAssistantDroppedBeforeText?: boolean;
      __blankAssistantSeen?: boolean;
    };

    return {
      pendingAssistantSeen: trackedWindow.__pendingAssistantSeen ?? false,
      chatLoadingStateSeen: trackedWindow.__chatLoadingStateSeen ?? false,
      assistantTextSeen: trackedWindow.__assistantTextSeen ?? false,
      pendingAssistantDroppedBeforeText:
        trackedWindow.__pendingAssistantDroppedBeforeText ?? false,
      blankAssistantSeen: trackedWindow.__blankAssistantSeen ?? false,
    };
  });
}

async function getScrollMetrics(page: Page): Promise<ScrollMetrics> {
  return page.locator('[data-slot="chat-message-scroll-area"]').evaluate((node) => {
    const container = node as HTMLDivElement;

    return {
      clientHeight: container.clientHeight,
      distanceFromBottom:
        container.scrollHeight - container.scrollTop - container.clientHeight,
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop,
    };
  });
}

async function waitForAssistantText(page: Page) {
  await expect.poll(async () => {
    const tracking = await getChatStateTracking(page);
    return tracking.assistantTextSeen;
  }, { timeout: 30000 }).toBe(true);
}

async function waitForScrollGrowth(page: Page, baselineHeight: number) {
  await expect.poll(async () => {
    const metrics = await getScrollMetrics(page);
    return metrics.scrollHeight - baselineHeight;
  }, { timeout: 30000 }).toBeGreaterThan(200);
}

async function scrollChatUp(page: Page, distance: number) {
  await page.locator('[data-slot="chat-message-scroll-area"]').evaluate(
    (node, offset) => {
      const container = node as HTMLDivElement;
      const nextTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight - (offset as number),
      );

      container.scrollTop = nextTop;
      container.dispatchEvent(new Event("scroll"));
    },
    distance,
  );
}

test.describe("Chat assistant placeholder", () => {
  test("shows the assistant placeholder immediately on first and subsequent sends", async ({
    page,
  }) => {
    await installChatStateTracking(page);

    const textarea = await openChat(page, username);

    await resetChatStateTracking(page);
    await sendChatMessage(textarea, firstMessage);

    await expect(page.getByText(firstMessage)).toBeVisible();
    await expect(textarea).toBeDisabled();
    await expect.poll(async () => {
      const tracking = await getChatStateTracking(page);
      return tracking.pendingAssistantSeen;
    }, { timeout: 5000 }).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/@${username}.*[?&]conversation=`));
    await expect.poll(async () => {
      const tracking = await getChatStateTracking(page);
      return tracking.assistantTextSeen;
    }, { timeout: 30000 }).toBe(true);
    const firstSendTracking = await getChatStateTracking(page);
    expect(firstSendTracking.chatLoadingStateSeen).toBe(false);
    expect(firstSendTracking.pendingAssistantDroppedBeforeText).toBe(false);
    expect(firstSendTracking.blankAssistantSeen).toBe(false);

    await expect(textarea).toBeEnabled({ timeout: 30000 });

    await resetChatStateTracking(page);
    await sendChatMessage(textarea, secondMessage);

    await expect(page.getByText(secondMessage)).toBeVisible();
    await expect(textarea).toBeDisabled();
    await expect.poll(async () => {
      const tracking = await getChatStateTracking(page);
      return tracking.pendingAssistantSeen;
    }, { timeout: 5000 }).toBe(true);
    await expect.poll(async () => {
      const tracking = await getChatStateTracking(page);
      return tracking.assistantTextSeen;
    }, { timeout: 30000 }).toBe(true);
    const secondSendTracking = await getChatStateTracking(page);
    expect(secondSendTracking.chatLoadingStateSeen).toBe(false);
    expect(secondSendTracking.pendingAssistantDroppedBeforeText).toBe(false);
    expect(secondSendTracking.blankAssistantSeen).toBe(false);
  });

  test("keeps streaming replies pinned to bottom until the user scrolls away", async ({
    page,
  }) => {
    await installChatStateTracking(page);

    const textarea = await openChat(page, username);

    await resetChatStateTracking(page);
    await sendChatMessage(textarea, longReplyMessage);

    await expect(textarea).toBeDisabled();
    await expect(page).toHaveURL(new RegExp(`/@${username}.*[?&]conversation=`));
    await expect(page.locator('[data-slot="chat-message"][data-variant="sent"]').last())
      .toContainText("80 numbered lines");
    await expect.poll(async () => {
      const tracking = await getChatStateTracking(page);
      return tracking.pendingAssistantSeen;
    }, { timeout: 5000 }).toBe(true);

    const pinnedBaseline = await getScrollMetrics(page);
    await waitForAssistantText(page);
    await waitForScrollGrowth(page, pinnedBaseline.scrollHeight);
    await expect.poll(async () => {
      const metrics = await getScrollMetrics(page);
      return metrics.distanceFromBottom;
    }, { timeout: 5000 }).toBeLessThan(24);
    await expect(textarea).toBeEnabled({ timeout: 30000 });

    await scrollChatUp(page, 400);

    const scrollToBottomButton = page.locator(
      '[data-slot="chat-message-scroll-to-bottom"]',
    );
    await expect(scrollToBottomButton).toBeVisible();
    await expect.poll(async () => {
      const metrics = await getScrollMetrics(page);
      return metrics.distanceFromBottom;
    }, { timeout: 5000 }).toBeGreaterThan(200);

    await resetChatStateTracking(page);
    await sendChatMessage(textarea, detachedReplyMessage);

    await expect(textarea).toBeDisabled();
    await expect(page.locator('[data-slot="chat-message"][data-variant="sent"]').last())
      .toContainText("detached line");
    await expect.poll(async () => {
      const tracking = await getChatStateTracking(page);
      return tracking.pendingAssistantSeen;
    }, { timeout: 5000 }).toBe(true);

    const detachedBaseline = await getScrollMetrics(page);
    await waitForAssistantText(page);
    await waitForScrollGrowth(page, detachedBaseline.scrollHeight);
    await expect.poll(async () => {
      const metrics = await getScrollMetrics(page);
      return metrics.distanceFromBottom;
    }, { timeout: 5000 }).toBeGreaterThan(200);
    await expect(scrollToBottomButton).toBeVisible();

    await scrollToBottomButton.click();
    await expect.poll(async () => {
      const metrics = await getScrollMetrics(page);
      return metrics.distanceFromBottom;
    }, { timeout: 5000 }).toBeLessThan(24);
    await expect(textarea).toBeEnabled({ timeout: 30000 });
  });
});
