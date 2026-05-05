---
id: FG_129
title: "CloneActions dispatcher unit test pins the server-built href bypass branch"
date: 2026-05-05
type: improvement
status: to-do
priority: p2
description: "useCloneActions().navigateToContent has two branches at clone-actions-context.tsx:74 — `const basePath = href ?? getContentHref(...)`. The agent path supplies `href` (server-built); the user-UI path omits it (client-recomposed). The agent-parity rule says the client must NOT recompose the URL when the server provided one. This branch is exercised only by the e2e, never asserted at unit level. A refactor that always called getContentHref would still pass the e2e while silently breaking the server-is-source-of-truth contract."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "A new test file `apps/mirror/app/[username]/_providers/__tests__/clone-actions-context.test.tsx` exists and renders `CloneActionsProvider` with mock router + chat search params"
  - "The test invokes `navigateToContent({ kind: 'articles', slug: 'x', href: '/@alice/articles/server-built' })` and asserts `router.push` receives a path containing `/@alice/articles/server-built` (NOT a recomposed `/@<profile.username>/...` shape)"
  - "A second test invokes `navigateToContent({ kind: 'articles', slug: 'x' })` (no href) and asserts `router.push` receives the client-composed `/@<profile.username>/articles/x` shape"
  - "Both tests verify the chat-aware query string suffix (`?chat=1&conversation=...`) is preserved when `isChatOpen === true`"
  - "`pnpm --filter=@feel-good/mirror test:unit` passes including the new tests"
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` both pass"
owner_agent: "Mirror frontend developer"
---

# CloneActions dispatcher unit test pins the server-built href bypass branch

## Context

Code review on `feature-agent-parity-architecture` (tests reviewer, P2 0.85) found that the dispatcher's two branches are unevenly covered.

`apps/mirror/app/[username]/_providers/clone-actions-context.tsx:70-78`:

```ts
const navigateToContent = useCallback<CloneActions["navigateToContent"]>(
  ({ kind, slug, href }) => {
    const basePath = href ?? getContentHref(profile.username, kind, slug);
    router.push(buildChatAwareHref(basePath), { scroll: false });
  },
  [router, profile.username, buildChatAwareHref],
);
```

The agent path (watcher → dispatcher) passes `href`. The user-UI path (list-item click → dispatcher) omits it. The agent-parity rule (`.claude/rules/agent-parity.md` § Href-parity invariant) is explicit:

> The agent path uses the server-built `href` from `resolveBySlug`'s result and passes it through to the dispatcher unchanged — the client **must not** recompose the URL template. The user-UI path calls `getContentHref` directly; the dispatcher composes the URL only when `href` is omitted by the caller.

The existing e2e (`chat-agent-navigates.authenticated.spec.ts`) exercises both paths but cannot detect the regression where someone refactors the dispatcher to always recompose: as long as `buildContentHref` (server) and `getContentHref` (client) produce the same string, the e2e passes. A divergent template change would silently route the agent to a 404 — exactly the failure mode the rule warns about.

The dispatcher unit test pins the contract directly: when `href` is provided, it is passed through unchanged.

## Goal

The "server-built href is passed through unchanged when provided; client recomposes only when omitted" contract is asserted at the unit level, so a refactor that breaks the bypass branch fails the test suite immediately rather than waiting for a template divergence to surface in production.

## Scope

- Create `apps/mirror/app/[username]/_providers/__tests__/clone-actions-context.test.tsx`.
- Test (a): `navigateToContent({ href, kind, slug })` with `href` provided → `router.push` receives the exact `href` value (with chat-aware suffix).
- Test (b): `navigateToContent({ kind, slug })` without `href` → `router.push` receives the `getContentHref`-composed value.
- Mock `useRouter`, `useChatSearchParams`, and `useProfileRouteData` to make the hook renderable in isolation.
- Verify the `?chat=1&conversation=...` suffix-preservation in both branches.

## Out of Scope

- Testing `getContentHref` itself — already covered by `apps/mirror/features/content/__tests__/types.test.ts:43-62`.
- Testing the watcher's call into the dispatcher — covered by FG_127.
- Testing `buildChatAwareHref` — its existing tests cover its behavior.
- Refactoring the dispatcher to remove the `??` branch.

## Approach

Use `@testing-library/react`'s `renderHook` (or `render` with a consumer component) to mount `CloneActionsProvider`. Mock `next/navigation` `useRouter` to return a `vi.fn()` for `push`. Mock the profile route data context to return a stable `profile.username`. Mock `useChatSearchParams` to return both an open-chat case (suffix preserved) and a closed case (no suffix).

The two test cases are mutually exclusive on whether `href` is provided. The test file should also assert the `scroll: false` option is passed to `router.push` since that is a documented invariant.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Create `apps/mirror/app/[username]/_providers/__tests__/` directory if it does not exist.
2. Create `clone-actions-context.test.tsx` with imports for `renderHook`, `vi`, `useCloneActions`, `CloneActionsProvider`.
3. Mock `next/navigation` to return a `useRouter` whose `push` is a `vi.fn()`.
4. Mock `./profile-route-data-context` to return `{ profile: { username: "alice" } }`.
5. Mock `@/hooks/use-chat-search-params` to return `{ isChatOpen: true, buildChatAwareHref: (p) => `${p}?chat=1` }`.
6. Test case (a): wrap the hook in `CloneActionsProvider` via a wrapper, call `result.current.navigateToContent({ kind: "articles", slug: "x", href: "/@alice/articles/server-built" })`, assert `pushSpy.toHaveBeenCalledWith("/@alice/articles/server-built?chat=1", { scroll: false })`.
7. Test case (b): same setup, call `navigateToContent({ kind: "articles", slug: "x" })`, assert `pushSpy.toHaveBeenCalledWith("/@alice/articles/x?chat=1", { scroll: false })`.
8. Optional test case (c): `isChatOpen: false`, verify no chat suffix appears.
9. Run `pnpm --filter=@feel-good/mirror test:unit` and confirm the new tests pass.

## Constraints

- The test must NOT depend on Convex test infrastructure — it is a pure React test.
- Do not change the dispatcher implementation; this ticket only adds tests.
- Do not test the watcher's behavior in this file (FG_127's territory).

## Resources

- `.claude/rules/agent-parity.md` § Href-parity invariant
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P2 #3
- Existing peer test patterns in `apps/mirror/hooks/__tests__/` for hook-mocking conventions
