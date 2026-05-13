---
id: FG_219
title: "E2E asserts non-owners do not see the Configure profile button"
date: 2026-05-13
type: chore
status: completed
priority: p2
description: "The new e2e spec covers only the owner happy path — owner clicks Configure profile, URL gains chatMode=configuration. There is no negative case asserting an unauthenticated visitor (or a logged-in non-owner) does NOT see the Configure profile button. A regression that exposes the owner-only affordance to non-owners would not be caught."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "apps/mirror/e2e/profile-configuration-chat.authenticated.spec.ts (or a sibling spec) contains a test that visits /@test-user as an unauthenticated visitor and asserts the 'Configure profile' button is not visible"
  - "A second test (or extension of the first) covers the case of a logged-in non-owner visiting another user's profile and confirms the same"
  - "pnpm --filter=@feel-good/mirror test:e2e passes"
owner_agent: "Playwright e2e engineer"
---

# E2E asserts non-owners do not see the Configure profile button

## Context

`apps/mirror/e2e/profile-configuration-chat.authenticated.spec.ts` has one test:

```ts
test("owner Configure profile button opens chat in configuration mode", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/@test-user");
  await waitForAuthReady(page);
  await page.getByRole("button", { name: "Configure profile" }).click();
  await expect(page).toHaveURL(/[?&]chat=1\b/);
  await expect(page).toHaveURL(/[?&]chatMode=configuration\b/);
  // ...
});
```

The owner-only visibility of the Configure profile button is controlled at `apps/mirror/app/[username]/_components/profile-panel.tsx:45` (`isOwner ? ... : null`) and `apps/mirror/app/[username]/_components/workspace-panels.tsx:107-112`. If a future refactor accidentally drops the `isOwner` guard or passes the wrong prop, non-owners would see the button. The server-side guard in `sendMessage` would still block the request, but the UI affordance would expose the owner-only feature.

The tests reviewer rated this P2: regression catch on owner-only UI affordance.

## Goal

A negative test pins the owner-only visibility of the Configure profile button. Removing the `isOwner` guard would cause the e2e suite to fail.

## Scope

- Either extend `apps/mirror/e2e/profile-configuration-chat.authenticated.spec.ts` or add a sibling spec (e.g., `profile-configuration-chat.visitor.spec.ts`).
- One test that asserts the button is not visible to an unauthenticated visitor.
- One test (optional, depending on fixture availability) that asserts the button is not visible to an authenticated non-owner.

## Out of Scope

- Server-side authorization tests for the configuration mutation (already covered by `rateLimits.test.ts` integration tests).
- Snapshotting the entire profile-panel for non-owners.

## Approach

Use Playwright's existing unauthenticated `page` fixture (the project likely has both `authenticatedPage` and a bare `page`). Visit `/@test-user` and assert the button is not in the DOM:

```ts
test.describe("Profile configuration helper chat — visibility", () => {
  test("unauthenticated visitor does not see the Configure profile button", async ({
    page,
  }) => {
    await page.goto("/@test-user");
    await expect(
      page.getByRole("button", { name: "Configure profile" }),
    ).not.toBeVisible();
  });
});
```

For the non-owner authenticated case, check whether the project has a fixture for a second test user; if so, add a second test. If not, the unauthenticated case alone pins the UI guard sufficiently for now.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Check `apps/mirror/e2e/fixtures/` for an unauthenticated fixture (likely the default `page` fixture from Playwright).
2. Add a test that uses the unauthenticated `page` and asserts the button is not visible.
3. If a "second user" fixture exists, add a test for the authenticated non-owner case as well.
4. Run `pnpm --filter=@feel-good/mirror test:e2e` to confirm the new test passes.
5. Manually break the `isOwner` guard (temporarily), re-run the e2e, confirm the test fails. Revert.

## Constraints

- Must use the existing Playwright CLI runner (per `.claude/rules/verification.md` — never Playwright MCP for e2e tests).
- Must not require seeded data beyond what the existing fixtures provide.

## Resources

- PR #93 tests review: `e2e-no-non-owner-button-visibility`
- `apps/mirror/e2e/profile-configuration-chat.authenticated.spec.ts` — existing spec
- `apps/mirror/e2e/fixtures/` — existing fixtures
- `.claude/rules/verification.md` — e2e tool boundary
