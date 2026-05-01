import { test, expect, type Page } from "@playwright/test";
import {
  RECEIVED_BUBBLE_SELECTOR,
  openChat,
  sendChatMessage,
} from "../helpers/chat";

/**
 * Wave 4 — Bio RAG cross-user isolation spec (FR-14, NFR-01).
 *
 * Verifies (per workspace/spec/2026-04-30-bio-tab-spec.md):
 *   - FR-14 — vector retrieval is scoped to the target clone's owner; entries
 *             from other users cannot leak into another user's chat context.
 *   - NFR-01 — cross-user isolation invariant (writes never accept a
 *              client-supplied userId; reads in chat retrieval never include
 *              rows belonging to other users).
 *
 * BLOCKED on dependent fixture infrastructure:
 *   - Two distinct test users (A and B), both with seeded bio entries AND
 *     clone configurations.
 *   - A deterministic vector index — see notes in
 *     `bio-rag-context.authenticated.spec.ts`.
 *   - A non-flaky assertion that user B's bio content does NOT appear in a
 *     reply to user A's clone (negative-match across non-deterministic LLM
 *     output).
 *
 * The unit-level guarantee that vector search is filtered by `userId`
 * (preventing the leak by construction) is covered by
 * `packages/convex/convex/chat/__tests__/rag-cross-user.test.ts`.
 * This e2e spec is the user-visible verification.
 *
 * Per spec line 35 and the Wave-4 directive's "punt cleanly" branch, this
 * file is the FR-14 deliverable; running it green requires the listed
 * infrastructure. Marked `test.fixme()` so Playwright reports it as
 * expected-deferred rather than failing.
 *
 * Filename ends in `.authenticated.spec.ts` for the same routing reason as
 * `bio-rag-context.authenticated.spec.ts`.
 */

test.describe("Bio RAG cross-user isolation — chats with A's clone never surface B's bio", () => {
  test.fixme(
    "FR-14 + NFR-01: visitor chats with A's clone after B has bio entries; reply contains no content from B",
    async ({ page }) => {
      // Future shape — keep the body so resolving the fixme is mechanical:
      //
      //   1. Seed user A: username `bio-rag-a`, clone configured, bio entries
      //      e.g. ["BA English, Yale, 2010–2014"].
      //   2. Seed user B: username `bio-rag-b`, clone configured (or just bio
      //      entries; the chat happens with A), bio entries e.g.
      //      ["MD Medicine, Stanford, 2010–2014"].
      //   3. await openChat(page, "bio-rag-a");
      //   4. Send a question whose semantic neighborhood would match BOTH
      //      users' entries: "Where did you go to college?"
      //   5. Read the streamed reply.
      //   6. expect(reply).not.toMatch(/Stanford/i);
      //      expect(reply).not.toMatch(/Medicine/i);
      //      expect(reply).not.toMatch(/MD\b/);
      //
      // Confidence is bolstered by the unit-level test in
      // `chat/__tests__/rag-cross-user.test.ts`, which asserts that the
      // `vectorSearch(..., { filter: q.eq("userId", profileOwnerId) })` call
      // returns zero rows for user B when filtered to user A.
      const _unused: Page = page;
      void _unused;
      void openChat;
      void sendChatMessage;
      void RECEIVED_BUBBLE_SELECTOR;
      void expect;
      // If the test.fixme() above is removed without filling in the body
      // (replacing this throw with the real negative-match assertions),
      // this throws so the FR-14 cross-user-isolation gap surfaces as a
      // hard failure instead of a vacuously-passing test.
      throw new Error(
        "FR-14 / NFR-01 RAG cross-user isolation test body not yet implemented — see step comments above; depends on two-user fixture infrastructure (clone configs for both A and B) and a deterministic embedding pipeline",
      );
    },
  );
});
