# Mirror Post Publish Toggle — Spec

## Overview

Add an owner-only control to the Mirror post detail page toolbar that lets the profile owner toggle a post's `status` between `draft` and `published`, with a confirmation dialog before either transition. The backend `update` mutation already supports this; the gap is purely UI. Non-owners and unauthenticated viewers must see no control.

## Requirements

### Functional Requirements

| ID    | Requirement                                                                                                                                                                                                             | Priority | Verification                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | A publish/unpublish control renders in `post-detail-toolbar.tsx` only when `useIsProfileOwner()` returns `true`.                                                                                                        | p0       | Unit test asserts the connector returns `null` when `useIsProfileOwner()` is mocked to `false`; e2e test visits a post as a non-owner and asserts the control is not in the DOM. |
| FR-02 | When the current post `status === "draft"`, the button label reads "Publish"; when `"published"`, it reads "Unpublish".                                                                                                 | p0       | Unit test renders `<PublishToggle status="draft" />` and `<PublishToggle status="published" />`; asserts button text.                              |
| FR-03 | Clicking the button opens an `AlertDialog` asking the owner to confirm the transition. Dialog copy names the target state ("Publish this post?" / "Move this post back to drafts?").                                   | p0       | Unit test: click button, assert dialog role `alertdialog` is visible with expected title; e2e test: click publish, assert confirmation dialog visible. |
| FR-04 | Confirming the dialog calls `api.posts.mutations.update` with `{ id: post._id, status: "published" \| "draft" }` (mutation arg is `id`, not `postId` — see `packages/convex/convex/posts/mutations.ts:84`) and closes the dialog on explicit success. | p0       | Unit test mocks `useMutation`, asserts it was called once with `{ id, status }`; e2e test confirms transition and asserts dialog is closed.         |
| FR-05 | Cancelling the dialog closes it without calling the mutation.                                                                                                                                                           | p0       | Unit test: click cancel, assert mutation mock was not called.                                                                                       |
| FR-06 | On mutation success, a sonner toast (success variant, using `@feel-good/ui/components/toast` with `CircleCheckIcon`) confirms "Post published" or "Post moved to drafts".                                               | p1       | Unit test spies on `toast.custom`; e2e test asserts the toast text appears.                                                                         |
| FR-07 | On mutation failure, a sonner error toast (`OctagonXIcon`) shows the error message and the dialog remains open so the user can retry. Dialog state MUST only be set to closed on explicit success (after awaited mutation resolves) or on user cancel — never in a `finally` or `catch`. | p1       | Unit test forces mutation to reject, asserts error toast fires AND `alertdialog` is still in the DOM after the rejected promise settles.          |
| FR-08 | While the mutation is in-flight, the confirm button shows a pending state (disabled + pending label) and cannot be double-submitted. Implementation MUST use a `useRef` guard (not only `useState`) to prevent double-submission on rapid clicks, matching the existing `markdown-upload-dialog-connector.tsx` pattern. | p1       | Unit test: resolve mutation after delay, assert confirm button is disabled AND two rapid clicks result in exactly one mutation call.              |
| FR-09 | After a successful transition in either direction, the Mirror post detail page reflects the new status without a full reload (Convex reactive query re-runs). `post-metadata.tsx` must mark the status label with `data-testid="post-status-label"` so tests can assert its presence/absence precisely. | p0       | E2E test: publish a draft, assert `[data-testid="post-status-label"]` disappears within 3s without navigation; unpublish a published post, assert it reappears. |
| FR-10 | Non-owners continue to be unable to view draft posts: `getBySlug` returns `null` for drafts when `!isOwner` (already enforced in `packages/convex/convex/posts/queries.ts:52`). This spec does not regress that behavior. | p0       | E2E test: as non-owner, navigate to a draft post URL, assert the Mirror 404/not-found UI renders.                                                   |

### Non-functional Requirements

| ID     | Requirement                                                                                                                                                                        | Priority | Verification                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Authorization is enforced server-side by `isOwnedByUser` in `packages/convex/convex/posts/mutations.ts:98`. Client-side hiding is a UX affordance only, not a security boundary.  | p0       | Manual review of the mutation; no new server code added. Spec does not introduce any client-only auth check as the source of truth.         |
| NFR-02 | New component files follow `.claude/rules/file-organization.md` connector/view split and live under `apps/mirror/features/posts/components/`.                                      | p0       | File review: connector file ends in `-connector.tsx`, view file has no context/hook imports.                                                 |
| NFR-03 | No hyphenated Convex file names are added (Convex constraint).                                                                                                                     | p0       | Spec adds no Convex files.                                                                                                                   |
| NFR-04 | `publishedAt` behavior: first draft→published transition sets `publishedAt = Date.now()`; subsequent published→draft→published transitions do NOT overwrite the original `publishedAt` (mutation already guards on `!post.publishedAt` at line 136). Spec documents this intentionally — the original publish date is preserved as historical truth. | p1       | Reviewer reads `packages/convex/convex/posts/mutations.ts:134-139` and confirms the guard. Spec adds an Anti-pattern entry against changing it. |

## Architecture

Data flow (owner viewing their own draft post detail page):

1. Server component `apps/mirror/app/[username]/@content/posts/[slug]/page.tsx` (lines 18-25) already fetches `post` via `fetchAuthQuery(api.posts.queries.getBySlug, ...)` and renders two independent siblings: `<WorkspaceToolbar><PostDetailToolbar ... /></WorkspaceToolbar>` (portal-injected) and `<PostDetail post={post} />`. `PostDetail` does NOT render the toolbar — the page does, directly.
2. The page passes `post` into `PostDetailToolbar` as a new prop alongside the existing `username`.
3. `PostDetailToolbar` (client component) renders `<PublishToggleConnector post={post} />` next to the existing "Back" link.
4. Connector calls `useIsProfileOwner()` from `apps/mirror/features/profile/context/profile-context.tsx:13`. If `false`, returns `null`. (This hook resolves inside the portal-rendered tree because `WorkspaceToolbar` is a React portal — the component tree identity is preserved, so the `ProfileContext` provider higher up in the profile layout still resolves.)
5. If `true`, connector owns: (a) dialog-open `useState`, (b) `isSubmittingRef` (`useRef<boolean>`) guard, (c) `useMutation(api.posts.mutations.update)`. It passes `status`, `isPending`, `onConfirm`, `onCancel` into presentational `<PublishToggle />`.
6. `<PublishToggle />` renders a button that opens an `AlertDialog` (from `@feel-good/ui/primitives/alert-dialog`). Confirm handler awaits the mutation: on resolve → show success toast, then `setDialogOpen(false)`; on reject → show error toast, DO NOT close dialog, clear `isSubmittingRef`.
7. Convex reactive query on the post detail page re-renders with the new status; `post-metadata.tsx` status label (tagged `data-testid="post-status-label"`) disappears automatically on publish / reappears on unpublish.

Files to create:

| File                                                                                        | Purpose                                                                                       |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/mirror/features/posts/components/publish-toggle-connector.tsx`                        | Reads `useIsProfileOwner()`, owns dialog state, `useRef` submission guard, mutation, toasts. |
| `apps/mirror/features/posts/components/publish-toggle.tsx`                                  | Pure UI: button + `AlertDialog`. Props: `status`, `isPending`, `onConfirm`, `onCancel`.      |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                    | Vitest unit tests for FR-01, FR-04, FR-05, FR-07, FR-08.                                      |
| `apps/mirror/features/posts/__tests__/publish-toggle.test.tsx`                              | Vitest unit tests for FR-02, FR-03 (pure UI rendering + dialog copy).                         |
| `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`                                 | Playwright e2e covering owner-side FR-03, FR-06, FR-09, plus FR-01/FR-10 under a separate unauthenticated browser context created inside the same authenticated spec (owner scenarios require the session, non-owner scenarios create a fresh context via `browser.newContext()`). |

Files to modify:

| File                                                                          | Change                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mirror/app/[username]/@content/posts/[slug]/page.tsx`                   | Pass `post={post as PostSummary}` into `<PostDetailToolbar />` alongside existing `username` prop. (`PostDetail` and `PostDetailToolbar` are independent siblings rendered by the page, not nested.) |
| `apps/mirror/features/posts/components/post-detail-toolbar.tsx`               | Accept new `post: PostSummary` prop, render `<PublishToggleConnector post={post} />` alongside the existing "Back" link.                                                                                |
| `apps/mirror/features/posts/components/post-metadata.tsx`                     | Add `data-testid="post-status-label"` to the status label element (currently at line 16–18).                                                                                                             |
| `apps/mirror/features/posts/index.ts` (barrel, if present)                    | Export `PostDetailToolbar`'s new prop types if the existing barrel exposes the type.                                                                                                                     |
| `apps/mirror/vitest.config.ts`                                                | Update `include` glob from `**/__tests__/**/*.test.ts` → `**/__tests__/**/*.test.{ts,tsx}` so `.test.tsx` files are discovered. (Current config at line 7 excludes `.tsx`.)                              |
| `packages/convex/convex/auth/testHelpers.ts`                                  | Extend `ensureTestUser` (or add a new `ensureTestPostFixtures`) internal mutation that seeds one draft post and one published post for the test user, returning their slugs. Used by e2e `beforeAll`.  |

Dependencies to add: none. All primitives, hooks, and mutations already exist.

## Unit Tests

| Test File                                                                                | Test Case                                                                                                 | Verifies         |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------- |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                 | returns `null` when `useIsProfileOwner()` is `false`                                                      | FR-01            |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                 | calls `api.posts.mutations.update` with `status: "published"` when owner confirms publish on a draft      | FR-04            |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                 | calls update with `status: "draft"` when owner confirms unpublish on a published post                     | FR-04            |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                 | does not call mutation when dialog is cancelled                                                           | FR-05            |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                 | fires sonner error toast and keeps dialog open when mutation rejects                                      | FR-07            |
| `apps/mirror/features/posts/__tests__/publish-toggle-connector.test.tsx`                 | disables confirm button while mutation is in-flight; second click is a no-op                              | FR-08            |
| `apps/mirror/features/posts/__tests__/publish-toggle.test.tsx`                           | renders "Publish" label for draft, "Unpublish" label for published                                        | FR-02            |
| `apps/mirror/features/posts/__tests__/publish-toggle.test.tsx`                           | opens `alertdialog` with expected title when button is clicked                                            | FR-03            |

Vitest, JSX test files use `.test.tsx`. The current `apps/mirror/vitest.config.ts` include glob (`**/__tests__/**/*.test.ts`) does NOT match `.test.tsx` — this spec requires updating the glob to `**/__tests__/**/*.test.{ts,tsx}` as part of implementation. (Pre-existing `clone-settings-panel.test.tsx` likely was not being run under the current glob; verify during implementation and call it out.) Mock `convex/react`'s `useMutation` and `@/features/profile/context/profile-context`'s `useIsProfileOwner`. Run via `pnpm --filter=@feel-good/mirror test:unit`.

## Playwright E2E Tests

| Test File                                                         | Scenario                                                                                                                                                    | Verifies            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`       | Owner (authenticated fixture) visits own draft post seeded in `beforeAll`, clicks Publish, confirms dialog, sees success toast, `post-status-label` disappears. | FR-03, FR-06, FR-09 |
| `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`       | Owner visits own published post seeded in `beforeAll`, clicks Unpublish, confirms dialog, status reverts to draft and `post-status-label` reappears.           | FR-03, FR-06, FR-09 |
| `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`       | Owner opens the dialog, clicks Cancel, status is unchanged and no toast fires.                                                                                | FR-05               |
| `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`       | Inside same spec, create a fresh unauthenticated context (`browser.newContext()`), visit the owner's published post — publish toggle is not present.            | FR-01               |
| `apps/mirror/e2e/post-publish-toggle.authenticated.spec.ts`       | Unauthenticated context navigates to the owner's draft post URL — sees Mirror's not-found UI.                                                                 | FR-10               |

E2E tests live in `apps/mirror/e2e/` per `apps/mirror/playwright.config.ts`. The authenticated `project` in `playwright.config.ts:29` matches `.authenticated.spec.ts` ONLY, so owner-side tests MUST use that suffix. Use the Playwright CLI only: `pnpm --filter=@feel-good/mirror test:e2e`. Follow the existing authenticated-fixture pattern from `apps/mirror/e2e/post-upload.authenticated.spec.ts`.

**Fixture requirement**: The owner-side e2e tests require known draft and published posts owned by `test-user`. Current `apps/mirror/e2e/` has no such fixture — seed data only contains `rick-rubin`'s published posts, and `ensureTestUser` in `packages/convex/convex/auth/testHelpers.ts` only creates a user, no posts. Implementation MUST add a `beforeAll` hook that calls a new Convex test helper mutation (e.g. `api.auth.testHelpers.ensureTestPostFixtures`) which creates a draft post and a published post owned by the test user (idempotent) and returns their slugs. `afterAll` MAY clean them up, or the mutation MAY upsert by a fixed slug.

## Anti-patterns to Avoid

- **Do not clear `publishedAt` on unpublish.** The mutation intentionally preserves the first-publish timestamp (`packages/convex/convex/posts/mutations.ts:136` guards on `!post.publishedAt`). Changing this would rewrite history and break downstream consumers that sort by `publishedAt`.
- **Do not rely on the client-side owner check as authorization.** Hiding the button is a UX affordance; `isOwnedByUser` in the mutation is the real boundary. Do not remove or weaken the server check "because the UI already hides it".
- **Do not use `setTimeout` to make the "Draft" label disappear after publish.** Convex reactive queries re-run automatically — let the reactive pipeline drive re-render. (See `workspace/lessons.md` / `.claude/rules/dev-process.md`.)
- **Do not close the dialog in a `finally` or `catch` block.** Dialog state must only be set to closed on explicit success (after the awaited mutation resolves) or on explicit user cancel. Closing in `finally` silently dismisses the dialog on error and loses the retry affordance (FR-07).
- **Do not rely solely on `useState` for the double-submission guard.** State updates are async and rapid clicks can race. Use a `useRef<boolean>` (`isSubmittingRef`) as the authoritative guard, matching the existing `markdown-upload-dialog-connector.tsx` pattern.
- **Do not name the e2e spec `post-publish-toggle.spec.ts`.** The unsuffixed name runs in the unauthenticated `chromium` Playwright project and silently fails owner scenarios because the publish toggle isn't rendered without a session. Use `.authenticated.spec.ts` so it runs in the authenticated project.
- **Do not pass `postId` as the mutation argument name.** The mutation declares `id: v.id("posts")` at `mutations.ts:84` — any client call using `postId` will throw a Convex validator error at runtime.
- **Do not create the publish toggle under a `views/` directory in the app.** Per `.claude/rules/file-organization.md`, all app-level components go in `components/`. `views/` is reserved for cross-app packages.
- **Do not inline the dialog trigger button and the AlertDialog state in the toolbar.** Keep the connector/view split: connector owns state + mutation, view is pure render.
- **Do not mock the Convex mutation in e2e tests.** E2E runs against a real Convex dev deployment; mocking defeats the purpose.

## Team Orchestration Plan

Small feature (5 new files, 6 modified). Two-step plan so backend fixture lands before the e2e depends on it.

```
Step 1 — Test infrastructure + fixtures
Agent: general
Tasks:
  1. Update apps/mirror/vitest.config.ts include glob to **/__tests__/**/*.test.{ts,tsx}.
  2. Add ensureTestPostFixtures helper in packages/convex/convex/auth/testHelpers.ts
     that idempotently creates one draft and one published post owned by test-user
     and returns their slugs.
  3. Regenerate Convex types (pnpm exec convex codegen) and verify mirror builds.
Verification:
  - pnpm build --filter=@feel-good/mirror
  - pnpm lint --filter=@feel-good/mirror

Step 2 — UI + tests
Agent: general
Tasks:
  1. Add data-testid="post-status-label" in post-metadata.tsx.
  2. Create publish-toggle.tsx (pure UI: button + AlertDialog, props-driven).
  3. Create publish-toggle-connector.tsx (owner guard, useState + useRef submission
     guard, useMutation(api.posts.mutations.update) called with { id, status }).
  4. Modify post-detail-toolbar.tsx to accept `post` prop and render the connector.
  5. Modify app/[username]/@content/posts/[slug]/page.tsx to pass `post` into the toolbar.
  6. Write publish-toggle.test.tsx and publish-toggle-connector.test.tsx.
  7. Write post-publish-toggle.authenticated.spec.ts (owner + non-owner scenarios via
     fresh browser.newContext()).
Verification (Tier 5 per .claude/rules/verification.md):
  - pnpm build --filter=@feel-good/mirror
  - pnpm lint --filter=@feel-good/mirror
  - pnpm --filter=@feel-good/mirror test:unit
  - pnpm --filter=@feel-good/mirror test:e2e -- post-publish-toggle.authenticated.spec.ts
  - Chrome MCP screenshot of owner view (button visible) and non-owner view (button hidden)
```

No specialized agent in `.claude/agents/` owns Mirror post UI — general agent is appropriate.

## Open Questions

- None. User answered all Phase 1 clarifications: toolbar-only placement, bidirectional (publish + unpublish), confirmation dialog required, profile-owner-only scope, draft visibility already enforced in Convex queries.

## Adversarial Review Summary

Stop reason: **quality bar met** — all 8 concerns resolved in one iteration; no unresolved Critical.

| Concern                                                                                                                        | Severity  | Resolution                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No fixture creates an owned draft post for `test-user`; owner e2e scenarios untestable as specified.                          | Critical  | **Accepted** — added Step 1 fixture task and e2e `beforeAll` using new `ensureTestPostFixtures` helper in `testHelpers.ts`. Architecture table lists it under Files to modify.                                                                      |
| Vitest `include` glob (`**/*.test.ts`) excludes `.test.tsx`; unit tests would silently not run.                                | Critical  | **Accepted** — added `apps/mirror/vitest.config.ts` update (`.test.{ts,tsx}`) to Files to modify and to Step 1 of the orchestration plan.                                                                                                           |
| Architecture said `post-detail.tsx` renders the toolbar; actually the page renders both as independent siblings via a portal. | Important | **Accepted** — rewrote Architecture data-flow (steps 1–4) and replaced "Modify `post-detail.tsx`" with "Modify `page.tsx`" in Files to modify.                                                                                                     |
| FR-07 "dialog stays open on error" lacks implementation constraint; common `finally`-close anti-pattern would break it.       | Important | **Accepted** — FR-07 now mandates dialog close only on explicit success/cancel; added explicit Anti-pattern entry; unit test asserts dialog still mounted after rejection.                                                                          |
| Mutation arg is `id`, not `postId` — spec's call signature would throw a Convex validator error at runtime.                   | Important | **Accepted** — FR-04 corrected to `{ id: post._id, status }`; added Anti-pattern entry calling out the `id` vs `postId` mismatch with file:line citation.                                                                                           |
| E2E file named `.spec.ts` instead of `.authenticated.spec.ts` — owner scenarios would run unauthenticated and silently pass.  | Important | **Accepted** — renamed to `post-publish-toggle.authenticated.spec.ts`; non-owner scenarios handled via `browser.newContext()` inside the same authenticated spec; added Anti-pattern entry citing `playwright.config.ts:29`.                       |
| Double-submission guard implementation approach unspecified.                                                                  | Minor     | **Accepted** — FR-08 now requires `useRef<boolean>` guard matching `markdown-upload-dialog-connector.tsx`; unit test asserts two rapid clicks → one mutation call; Anti-pattern entry added against state-only guard.                               |
| "Draft" label assertion in FR-09 fragile without `data-testid`; toast copy could confuse text matchers.                        | Minor     | **Accepted** — FR-09 now requires `data-testid="post-status-label"` on the status label; `post-metadata.tsx` added to Files to modify; e2e assertions scoped to that selector.                                                                      |
