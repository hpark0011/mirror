---
id: FG_264
title: "Configuration chat opens to fresh composer even during conversations load window"
date: 2026-05-22
type: fix
status: completed
priority: p2
description: "On branch hpark0011/post-edit-route-error, ChatRouteController's routeResolution useMemo at apps/mirror/app/[username]/_providers/chat-route-controller.tsx:137-141 gates the conversations.length>0 arm on chatMode !== 'configuration' but does NOT gate conversationsLoading. So while the Convex useConversations query is in-flight for configuration mode, routeResolution returns { status: 'resolving' } and the owner sees a spinner / loading state instead of the fresh composer the fix is meant to land on. Once the query resolves with existing conversations, the code correctly returns 'empty'. The loading window is bounded by query round-trip latency (not indefinite), but it directly contradicts the stated intent — configuration mode should render a fresh composer immediately. Tighten the condition to chatMode !== 'configuration' && (conversationsLoading || conversations.length > 0) so configuration mode bypasses 'resolving' entirely."
dependencies: []
acceptance_criteria:
  - "apps/mirror/app/[username]/_providers/chat-route-controller.tsx:137-141 — the routeResolution useMemo's resolving branch reads `chatMode !== \"configuration\" && (conversationsLoading || conversations.length > 0)` (or an equivalent boolean expression that gates BOTH conversationsLoading AND conversations.length>0 on chatMode)."
  - "A new unit test in apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx mounts with mockChatMode='configuration', mockConversationsLoading=true (add to the mock shape if needed), and asserts routeResolution equals { status: 'empty' }."
  - "Clone-mode behavior is unchanged: with mockChatMode='clone' and conversationsLoading=true (no conversations yet), routeResolution still equals { status: 'resolving' } — pin with an explicit test."
  - "All existing tests in chat-route-controller.test.tsx continue to pass."
  - "pnpm --filter=@feel-good/mirror test:unit passes."
  - "pnpm --filter=@feel-good/mirror lint passes."
---

# Configuration chat opens to fresh composer even during conversations load window

## Context

Branch `hpark0011/post-edit-route-error` adds a configuration-mode skip to the auto-select effect and to the `conversations.length > 0` arm of `routeResolution`. Code review caught one half-gated branch:

```ts
// apps/mirror/app/[username]/_providers/chat-route-controller.tsx:137-141
if (
  conversationsLoading ||
  (chatMode !== "configuration" && conversations.length > 0)
)
  return { status: "resolving" };
```

The `chatMode !== "configuration"` check protects the `conversations.length > 0` arm but not the `conversationsLoading` arm. So when an owner opens Configure Profile while `useConversations({ mode: "configuration" })` is in-flight (cold open of the panel, slow connection, refetch after invalidation), `routeResolution` is `{ status: "resolving" }` until the query lands. The composer doesn't render; the owner sees whatever the "resolving" branch renders (today: a loading shell). Once the query resolves with existing conversations, the memo correctly returns `{ status: "empty" }` and the composer paints.

This contradicts the stated intent — "Configuration mode intentionally opens a fresh composer" (per the comment at lines 107-110 the diff adds). The loading window is bounded by query latency, not indefinite, but on a fresh page load or slow connection it's a visible UX wart and the same shape the PR was meant to eliminate.

Tighten the condition to gate both arms on `chatMode`:

```ts
if (chatMode !== "configuration" && (conversationsLoading || conversations.length > 0))
  return { status: "resolving" };
```

This is a one-expression rewrite. The semantic change: configuration mode skips `"resolving"` entirely and goes straight to `"empty"` (or `"ready"` if `effectiveConversationId` is set, which is checked earlier in the same memo).

## Scope

- Tighten the `routeResolution` memo's resolving branch as above.
- Pin both the new behavior (configuration + loading → empty) and the preserved behavior (clone + loading → resolving) with unit tests.
- Confirm the existing test for clone-mode auto-select (which asserts `"resolving"` during the auto-select window) is unaffected — it does not exercise a loading=true state.

## Approach

Single-expression rewrite. The new condition reads more naturally because both ARMS are gated by the same chatMode guard — no inline negation polarity flip across arms (this also addresses the polarity smell flagged as Finding #8 in the code review, eliminated as a side-effect rather than refactored separately).

**Before:**

```ts
if (
  conversationsLoading ||
  (chatMode !== "configuration" && conversations.length > 0)
)
  return { status: "resolving" };
```

**After:**

```ts
if (
  chatMode !== "configuration" &&
  (conversationsLoading || conversations.length > 0)
)
  return { status: "resolving" };
```

The useMemo dep array already includes `chatMode`, `conversationsLoading`, and `conversations.length` — no change.

The test file currently mocks `isLoading: false` in the `useConversations` mock (line 50 of `chat-route-controller.test.tsx`). To pin the new behavior, expose `isLoading` as a mutable mock variable (`mockConversationsLoading`) the same way `mockChatMode` and `mockConversations` are mutable:

```ts
let mockConversationsLoading = false;

vi.mock("@/features/chat", () => ({
  useConversations: (args: unknown) => {
    useConversationsSpy(args);
    return {
      conversations: mockConversations,
      isLoading: mockConversationsLoading,
    };
  },
}));

// In afterEach:
mockConversationsLoading = false;
```

Then the two new tests:

```ts
it("configuration mode + conversationsLoading → empty (not resolving)", () => {
  let latest: Captured | null = null;
  mockChatMode = "configuration";
  mockConversationsLoading = true;

  render(
    <Wrapper>
      <CaptureContext onValue={(v) => (latest = v)} />
    </Wrapper>,
  );

  expect(latest!.routeResolution).toEqual({ status: "empty" });
});

it("clone mode + conversationsLoading still returns resolving (regression guard)", () => {
  let latest: Captured | null = null;
  mockChatMode = "clone";
  mockConversationsLoading = true;
  mockConversations = []; // ensure conversations.length=0 so the resolving arm is forced by loading alone

  render(
    <Wrapper>
      <CaptureContext onValue={(v) => (latest = v)} />
    </Wrapper>,
  );

  expect(latest!.routeResolution).toEqual({ status: "resolving" });
});
```

The second test is the regression guard — it would fail if anyone "simplifies" the condition by dropping `conversationsLoading` from clone-mode coverage.

## Implementation Steps

1. Read `apps/mirror/app/[username]/_providers/chat-route-controller.tsx:132-150` to confirm the current condition and dep array.
2. Rewrite the resolving branch condition as above (one expression change).
3. Read `apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx:46-54` and add `mockConversationsLoading` as a mutable mock variable (top of file with the other `mock*` declarations), wire it into the `useConversations` mock, and reset it in `afterEach`.
4. Add the two new `it(...)` cases to the existing describe block.
5. Run `pnpm --filter=@feel-good/mirror test:unit -- run apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx` and confirm all cases pass.
6. Smoke-check the regression value: temporarily revert the condition to the original form, rerun the test, confirm the configuration+loading test fails, then restore the fix.
7. Run `pnpm --filter=@feel-good/mirror test:unit` and `pnpm --filter=@feel-good/mirror lint` to confirm no collateral breakage.

## Out of Scope

- Refactoring the polarity smell with a named `willAutoSelectLatest` boolean (Finding #8 from review). The tighter expression in this fix already eliminates the inline-negation-in-two-places concern as a side-effect; the rename refactor is unnecessary.
- Adding e2e coverage for the loading-window UX — unit-level coverage on the resolution state machine is sufficient.
- Restructuring the `useConversations` query to skip the loading state in configuration mode entirely. The query still has to run if the owner later wants to resume a saved conversation from the list sheet; gating routeResolution is the right layer.

## Resources

- `apps/mirror/app/[username]/_providers/chat-route-controller.tsx:132-150` — the routeResolution useMemo.
- `apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx:46-54` — the useConversations mock to extend.
- Code review report on `hpark0011/post-edit-route-error` — Finding #7 (P2, correctness).
- `workspace/lessons.md` (2026-05-22) — "configuration mode should show a fresh composer unless the user explicitly chooses a saved conversation".
