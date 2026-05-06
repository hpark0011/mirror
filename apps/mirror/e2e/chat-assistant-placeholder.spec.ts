// FG_163 (Option D, with prompt-swap kept for future use): the second test
// (`keeps streaming replies pinned to bottom until the user scrolls away`)
// is marked `test.fixme` because pixel-based scroll-growth assertions
// cannot pass with STYLE_RULES short replies on a single exchange — the
// chat panel's clientHeight exceeds the cumulative content height of one
// user msg + one organic assistant reply, so `scrollHeight === clientHeight`
// and no growth is observable. The long-reply prompts were updated to
// organic single-item questions (instead of the original 80-numbered-lines
// filler-content prompts that the persona refuses) so that a future
// Option B redesign — build up scroll content with several short messages
// before testing pin/un-pin behavior — only needs to add the priming step
// and unfixme. See workspace/tickets/to-do/FG_163-*.md.
import { expect, test, type Page } from "@playwright/test";
import { openChat, sendChatMessage } from "./helpers/chat";

const username = "rick-rubin";
const firstMessage = "Reply with exactly: ok";
const secondMessage = "Reply with exactly: hi";
const longReplyMessage =
  "What's one record you produced that taught you the most about creativity? Tell me what made it stand out.";
const detachedReplyMessage =
  "What's the single most important thing you've learned about helping artists do their best work?";

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
      __resolvingStateSeen?: boolean;
    };
    const pendingAssistantSelector = '[data-pending-assistant="true"]';
    const loadingStateSelector = '[data-slot="chat-message-loading-state"]';
    const resolvingStateSelector = '[data-slot="chat-thread-resolving"]';
    const blankAssistantSelector =
      '[data-assistant-empty="true"]:not([data-pending-assistant="true"])';
    const receivedBubbleSelector =
      '[data-slot="chat-message"][data-variant="received"] [data-slot="chat-message-bubble"]';

    trackedWindow.__pendingAssistantSeen = false;
    trackedWindow.__chatLoadingStateSeen = false;
    trackedWindow.__assistantTextSeen = false;
    trackedWindow.__pendingAssistantDroppedBeforeText = false;
    trackedWindow.__blankAssistantSeen = false;
    trackedWindow.__resolvingStateSeen = false;

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

      if (document.querySelector(resolvingStateSelector)) {
        trackedWindow.__resolvingStateSeen = true;
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
      __resolvingStateSeen?: boolean;
    };

    trackedWindow.__pendingAssistantSeen = false;
    trackedWindow.__chatLoadingStateSeen = false;
    trackedWindow.__assistantTextSeen = false;
    trackedWindow.__pendingAssistantDroppedBeforeText = false;
    trackedWindow.__blankAssistantSeen = false;
    trackedWindow.__resolvingStateSeen = false;
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
      __resolvingStateSeen?: boolean;
    };

    return {
      pendingAssistantSeen: trackedWindow.__pendingAssistantSeen ?? false,
      chatLoadingStateSeen: trackedWindow.__chatLoadingStateSeen ?? false,
      assistantTextSeen: trackedWindow.__assistantTextSeen ?? false,
      pendingAssistantDroppedBeforeText:
        trackedWindow.__pendingAssistantDroppedBeforeText ?? false,
      blankAssistantSeen: trackedWindow.__blankAssistantSeen ?? false,
      resolvingStateSeen: trackedWindow.__resolvingStateSeen ?? false,
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
  // FG_163: threshold lowered from 200 to 40 — organic replies under
  // STYLE_RULES are typically 1–3 sentences, ~30–80px of bubble growth.
  await expect.poll(async () => {
    const metrics = await getScrollMetrics(page);
    return metrics.scrollHeight - baselineHeight;
  }, { timeout: 30000 }).toBeGreaterThan(40);
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
    expect(firstSendTracking.resolvingStateSeen).toBe(false);

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
    expect(secondSendTracking.resolvingStateSeen).toBe(false);
  });

  // FG_163: pixel-based scroll-growth assertions cannot pass with
  // STYLE_RULES short replies on a single exchange. The bridge fix on
  // `fix-message-error` does not affect this test. Unfixme once Option B
  // (priming the chat with several messages to overflow the viewport)
  // or Option C (test-mode bypass of STYLE_RULES) ships.
  test.fixme("keeps streaming replies pinned to bottom until the user scrolls away", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await installChatStateTracking(page);

    const textarea = await openChat(page, username);

    await resetChatStateTracking(page);
    await sendChatMessage(textarea, longReplyMessage);

    await expect(textarea).toBeDisabled();
    await expect(page).toHaveURL(new RegExp(`/@${username}.*[?&]conversation=`));
    await expect(page.locator('[data-slot="chat-message"][data-variant="sent"]').last())
      .toContainText("one record you produced");
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
    // FG_163: lowered from 200 to 100 — `AUTO_SCROLL_THRESHOLD_PX = 96` in
    // chat-message-list.tsx is the boundary at which the scroll-to-bottom
    // button appears, so >100 confirms the user is detached without
    // requiring a 200px scrollback that organic-length content cannot
    // guarantee.
    await expect.poll(async () => {
      const metrics = await getScrollMetrics(page);
      return metrics.distanceFromBottom;
    }, { timeout: 5000 }).toBeGreaterThan(100);

    await resetChatStateTracking(page);
    await sendChatMessage(textarea, detachedReplyMessage);

    await expect(textarea).toBeDisabled();
    await expect(page.locator('[data-slot="chat-message"][data-variant="sent"]').last())
      .toContainText("single most important thing");
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
    }, { timeout: 5000 }).toBeGreaterThan(100);
    await expect(scrollToBottomButton).toBeVisible();

    await scrollToBottomButton.click();
    await expect.poll(async () => {
      const metrics = await getScrollMetrics(page);
      return metrics.distanceFromBottom;
    }, { timeout: 5000 }).toBeLessThan(24);
    await expect(textarea).toBeEnabled({ timeout: 30000 });
  });
});
