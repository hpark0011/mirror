import { test, expect, type Page } from "@playwright/test";
import {
  RECEIVED_BUBBLE_SELECTOR,
  openChat,
  sendChatMessage,
} from "../helpers/chat";

/**
 * Wave 4 — Bio RAG context spec (clone-chat retrieval, FR-12 + FR-13).
 *
 * Verifies (per workspace/spec/2026-04-30-bio-tab-spec.md):
 *   - FR-12 — bio entries are embedded into `contentEmbeddings` and survive
 *             the published-status gate (kind === "bio" branch).
 *   - FR-13 — the clone-chat agent retrieves bio entries via the existing
 *             `vectorSearch("contentEmbeddings", "by_embedding", { filter })`
 *             call site WITHOUT code changes to retrieval, and bio chunks
 *             reach the system prompt.
 *
 * BLOCKED on dependent fixture infrastructure:
 *   1. A clone configuration for the bio-owner test user — without one, the
 *      chat route cannot stream a reply.
 *   2. A deterministic embedding pipeline — production uses a live LLM via
 *      @ai-sdk/google with a real API key; the unit test path stubs `embed`
 *      with `convex-test`, but the e2e path runs against the real Convex
 *      deployment and would hit the live model.
 *   3. A non-flaky assertion strategy for "the reply mentions CS / MIT /
 *      2014–2018" — model output is non-deterministic.
 *
 * Per spec line 35 ("the spec carries forward the dependency rather than
 * skipping the assertion") and the Wave-4 directive's "punt cleanly" branch,
 * the spec file is the FR-12/FR-13 deliverable; running it green requires
 * the listed infrastructure. Marked `test.fixme()` so Playwright reports it
 * as expected-deferred rather than failing.
 *
 * Filename ends in `.authenticated.spec.ts` so the chat session uses the
 * authenticated-anon path — the fixture is loaded for consistency with the
 * future-state implementation that will need session context for daily-bucket
 * tracking, even though the chat itself is anonymous.
 */

test.describe("Bio RAG context — chat retrieval references bio entries", () => {
  test.fixme(
    "FR-12 + FR-13: clone reply references bio entry text (CS / MIT / 2014–2018)",
    async ({ page }) => {
      // Future shape — keep this body so resolving the fixme is mechanical:
      //
      //   1. Seed the clone-owning test user with username + clone config.
      //   2. Seed a unique bio entry: "BS Computer Science, MIT, 2014–2018".
      //   3. await openChat(page, <bio-owner-username>);
      //   4. Send: "Where did you go to college?"
      //   5. Read the streamed reply (waitForReplyAndRead pattern from
      //      chat-plain-text.spec.ts).
      //   6. expect(reply).toMatch(/Computer Science|CS/i);
      //      expect(reply).toMatch(/MIT/i);
      //      expect(reply).toMatch(/201[4-8]/);
      //
      // See `apps/mirror/e2e/chat-plain-text.spec.ts:waitForReplyAndRead` for
      // the canonical "wait for stream complete" pattern.
      const _unused: Page = page;
      void _unused;
      void openChat;
      void sendChatMessage;
      void RECEIVED_BUBBLE_SELECTOR;
      void expect;
      // If the test.fixme() above is removed without filling in the body
      // (replacing this throw with the real assertions), this throws so
      // the FR-12 / FR-13 gap surfaces as a hard failure rather than a
      // vacuously-passing test.
      throw new Error(
        "FR-12 / FR-13 RAG context test body not yet implemented — see step comments above; depends on /test/ensure-bio-fixtures clone-config extension and a deterministic embedding pipeline",
      );
    },
  );
});
