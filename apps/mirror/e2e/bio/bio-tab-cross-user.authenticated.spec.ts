import { test, expect } from "../fixtures/auth";
import { ConvexHttpClient } from "convex/browser";

import { api } from "@feel-good/convex/convex/_generated/api";

/**
 * Wave 4 — Bio cross-user authorization spec (FR-11, NFR-01).
 *
 * Scope of this e2e spec:
 *   This file exercises the **`authMutation` session-guard rejection** at
 *   the Convex HTTP boundary — calling `bio.mutations.create` without an
 *   auth token throws and the target user's bio is unchanged. That locks
 *   the user-visible contract that a malicious client can't write to
 *   someone else's bio over the wire.
 *
 *   The complementary **validator-shape invariant** ("`create` does not
 *   accept a `userId` arg" — FR-11's structural guarantee) is proven by
 *   Vitest in `packages/convex/convex/bio/__tests__/mutations.test.ts:177`
 *   ("FR-11: create's args validator does NOT include userId"), which uses
 *   the in-process Convex test harness with the regex matcher
 *   `/Validator error.*Unexpected field.*userId/`. That's the canonical
 *   FR-11 proof. Replicating that assertion through an HTTP client would
 *   require extracting the auth token from storage state and is deferred —
 *   it would test our Playwright cleverness rather than the user-visible
 *   contract.
 *
 *   Combined coverage:
 *     - Vitest ⇒ the `create` validator rejects an unexpected `userId`
 *       arg with the documented error shape.
 *     - This e2e ⇒ the `authMutation` wrapper rejects unauthenticated
 *       callers and the target's bio is unchanged after the rejection.
 *
 * Strategy: the e2e auth fixture loads a session for `playwright-test@mirror.test`
 * (username `test-user`). We seed a separate target user (`bio-target` /
 * `playwright-bio-target@mirror.test`), give that user a bio entry, then
 * from the authenticated browser context we (a) call
 * `api.bio.mutations.create` directly via `ConvexHttpClient` — without
 * auth headers — and assert the call rejects, and (b) re-read the target
 * user's bio after the failed call to confirm it remains unchanged.
 *
 * Filename ends in `.authenticated.spec.ts` so Playwright's `authenticated`
 * project runs the auth.setup.ts dependency. The cross-user assertion logic
 * itself doesn't need the storage state, but the fixture-seed payloads
 * depend on the test user existing.
 */

const targetUsername = "bio-target";
const targetEmail = "playwright-bio-target@mirror.test";

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const testSecret = process.env.PLAYWRIGHT_TEST_SECRET!;

type SeedEntry = {
  kind: "work" | "education";
  title: string;
  startDate: number;
  endDate: number | null;
  description?: string;
  link?: string;
};

function monthEpoch(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1);
}

async function ensureTargetUser(): Promise<void> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-user`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: targetEmail, username: targetUsername }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-user failed (${res.status}) for ${targetEmail}: ${body}`,
    );
  }
}

async function ensureTargetBioFixtures(
  entries: ReadonlyArray<SeedEntry>,
): Promise<void> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-bio-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-secret": testSecret,
    },
    body: JSON.stringify({ email: targetEmail, entries }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `ensure-bio-fixtures failed (${res.status}) for ${targetEmail}: ${body}`,
    );
  }
}

test.describe("Bio cross-user authorization (FR-11, NFR-01)", () => {
  test("authMutation session-guard rejects unauth callers; target's bio is unchanged (validator-shape invariant covered by Vitest)", async () => {
    await ensureTargetUser();
    const seedTitle = "Engineer at Original Co";
    await ensureTargetBioFixtures([
      {
        kind: "work",
        title: seedTitle,
        startDate: monthEpoch(2020, 1),
        endDate: monthEpoch(2022, 1),
      },
    ]);

    const client = new ConvexHttpClient(convexUrl);

    // No auth headers. authMutation requires a Better Auth session — the
    // call MUST throw. NOTE: the validator on `create` has NO `userId` arg
    // (per FR-11), so even an authenticated caller cannot target another
    // user's bio. The unauth path is the easiest to exercise from
    // Playwright; the no-userId-arg invariant is enforced by FR-11's
    // validator-level Vitest in the convex package.
    let rejected = false;
    let errorMessage = "";
    try {
      await client.mutation(api.bio.mutations.create, {
        kind: "work",
        title: "INJECTED — should not appear",
        startDate: monthEpoch(2025, 1),
        endDate: null,
      });
    } catch (err) {
      rejected = true;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    expect(rejected, "create mutation must reject without a session").toBe(
      true,
    );
    // Generic ConvexError text — exact message depends on authMutation's
    // wrapper; assert the call did NOT silently succeed by re-reading.
    expect(errorMessage.length).toBeGreaterThan(0);

    // Re-read the target's bio via the public read path — the seeded entry
    // is still there and the injection attempt did NOT land.
    const entries = await client.query(api.bio.queries.getByUsername, {
      username: targetUsername,
    });
    expect(Array.isArray(entries)).toBe(true);
    expect(entries?.length).toBe(1);
    expect(entries?.[0]?.title).toBe(seedTitle);
    expect(entries?.some((e) => e.title.includes("INJECTED"))).toBe(false);
  });

  test("FR-04 (signed-in non-owner branch): owner controls absent when authenticated user views another user's bio", async ({
    authenticatedPage: page,
  }) => {
    // Setup: ensure bio-target user exists and has a seeded entry. The
    // signed-in browser context belongs to `playwright-test@mirror.test`
    // (username `test-user`), so navigating to /@bio-target/bio puts a
    // signed-in NON-owner in front of the bio panel — the third FR-04
    // sub-case (signed-out coverage lives in `bio-tab-public.spec.ts`'s
    // FR-02 test; signed-in OWNER coverage lives in
    // `bio-tab-owner-crud.authenticated.spec.ts`).
    await ensureTargetUser();
    await ensureTargetBioFixtures([
      {
        kind: "work",
        title: "Engineer at Original Co",
        startDate: monthEpoch(2020, 1),
        endDate: monthEpoch(2022, 1),
      },
    ]);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${targetUsername}/bio`, {
      waitUntil: "domcontentloaded",
    });

    // Bio panel renders for the visitor.
    await expect(page.getByTestId("bio-panel")).toBeVisible({
      timeout: 10_000,
    });

    // The seeded card is visible.
    const cards = page.getByTestId("bio-entry-card");
    await expect(cards).toHaveCount(1, { timeout: 10_000 });

    // FR-04: owner controls MUST NOT render for a signed-in non-owner.
    await expect(page.getByTestId("bio-entry-edit")).toHaveCount(0);
    await expect(page.getByTestId("bio-entry-delete")).toHaveCount(0);
    await expect(page.getByTestId("bio-add-entry-button")).toHaveCount(0);
  });
});
