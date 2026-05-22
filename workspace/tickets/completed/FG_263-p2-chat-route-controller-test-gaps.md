---
id: FG_263
title: "ChatRouteController tests pin URL-wins, bridge-wins, and chatMode-dep invariants"
date: 2026-05-22
type: improvement
status: completed
priority: p2
description: "Branch hpark0011/post-edit-route-error adds two tests for the configuration auto-select fix, but the intent packet from code review names three additional invariants that no test covers. Each is currently protected only by the ordering of branches inside the routeResolution useMemo / the useEffect — a future refactor that reorders them would silently break the invariant with no test failure. The lessons.md 2026-05-22 entry explicitly asks for tests on both halves; this ticket adds the three uncovered cases as additions to the existing describe block in chat-route-controller.test.tsx, so a regression in any of the three protections fails CI immediately."
dependencies: []
acceptance_criteria:
  - "apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx contains a new test that sets mockChatMode='configuration' AND mockRawConversationId='conv_abc' (any string id), renders, and asserts routeResolution equals { status: 'ready', conversationId: 'conv_abc' } AND setConversationSpy was NOT called."
  - "The same file contains a new test that sets mockChatMode='configuration', renders, calls act(() => handleConversationIdChange('conv_new')), and asserts routeResolution equals { status: 'ready', conversationId: 'conv_new' } (bridge wins regardless of mode)."
  - "The same file contains a new test that renders with mockChatMode='clone' AND mockConversations populated, asserts setConversationSpy was called once with the latest id, then changes mockChatMode='configuration' and rerenders, and asserts setConversationSpy was NOT called again (catches removal of chatMode from the useEffect dep array)."
  - "pnpm --filter=@feel-good/mirror test:unit -- run apps/mirror/app/\\[username\\]/_providers/__tests__/chat-route-controller.test.tsx passes."
  - "The three new tests use the existing mockChatMode / mockConversations / setConversationSpy fixtures already defined at the top of the file — no new mock infrastructure introduced."
  - "pnpm --filter=@feel-good/mirror lint passes."
---

# ChatRouteController tests pin URL-wins, bridge-wins, and chatMode-dep invariants

## Context

Branch `hpark0011/post-edit-route-error` adds two tests to `apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx` covering the new configuration auto-select guard:

1. Clone mode with populated conversations → auto-selects latest (positive case).
2. Configuration mode with populated conversations → `routeResolution === { status: 'empty' }`, no `setConversation` call (negative case).

The 2026-05-22 lessons.md entry explicitly asks for "both halves" pinned, and those two cover the auto-select effect. But code review on the same branch surfaced three additional invariants that are protected by `routeResolution` memo branch ordering and `useEffect` dep arrays — protections that a future refactor could silently remove with no test failure:

- **Configuration + URL conversationId → ready.** The memo's `if (effectiveConversationId)` branch fires before the new `chatMode !== 'configuration'` guard, so configuration mode with `?conversation=<id>` still resolves to `ready`. If the memo is reordered (e.g. to push the chatMode check earlier), this silently breaks and the owner who navigates to a saved configuration conversation gets an empty composer with no error.
- **Configuration + bridge id → ready.** Same reasoning: `pendingNewConversationId` flows into `effectiveConversationId` which the memo checks first. A reorder would break configuration-mode "start new conversation" flows.
- **Mid-lifecycle chatMode transition.** All current tests set `mockChatMode` once before render. If `chatMode` is dropped from the `useEffect` dep array, the stale-closure auto-select bug returns and no test catches it.

All three are additions to the existing `describe("ChatRouteController — pendingNewConversationId bridge", ...)` block — same file, same mocks, same fixtures. The marginal cost is ~30 lines of test code; the marginal value is three explicit invariants that fail loudly if anyone reorders the memo branches or trims the dep array.

## Scope

- Add three new `it(...)` cases to the existing describe block in `chat-route-controller.test.tsx`.
- Use the existing mutable mock state at the top of the file (`mockChatMode`, `mockRawConversationId`, `mockConversations`, `setConversationSpy`). Reuse the `afterEach` cleanup already present.

## Approach

Append the three new cases after the two added on this branch (around line 305 of the current file). Reuse the `Wrapper` / `CaptureContext` pattern verbatim — no new helpers. The tests follow the same shape as the existing ones (mutate module-level mock state, `render`, assert on `latest.routeResolution` and `setConversationSpy`).

```ts
it("URL conversationId wins in configuration mode → ready, no auto-select call", () => {
  let latest: Captured | null = null;
  mockChatMode = "configuration";
  mockRawConversationId = "conv_config_abc";

  render(
    <Wrapper>
      <CaptureContext onValue={(v) => (latest = v)} />
    </Wrapper>,
  );

  expect(latest!.routeResolution).toEqual({
    status: "ready",
    conversationId: "conv_config_abc",
  });
  expect(setConversationSpy).not.toHaveBeenCalled();
});

it("bridge id wins in configuration mode → ready immediately after handleConversationIdChange(newId)", () => {
  let latest: Captured | null = null;
  mockChatMode = "configuration";

  render(
    <Wrapper>
      <CaptureContext onValue={(v) => (latest = v)} />
    </Wrapper>,
  );

  const newId = "conv_config_new";
  act(() => {
    latest!.handleConversationIdChange(newId as Id<"conversations">);
  });

  expect(latest!.routeResolution).toEqual({
    status: "ready",
    conversationId: newId,
  });
  expect(setConversationSpy).toHaveBeenCalledWith(newId);
});

it("chatMode transition from clone → configuration does not re-fire auto-select", () => {
  let latest: Captured | null = null;
  mockConversations = [
    { _id: "conv_clone", _creationTime: 2 },
    { _id: "conv_clone_old", _creationTime: 1 },
  ];

  const { rerender } = render(
    <Wrapper>
      <CaptureContext onValue={(v) => (latest = v)} />
    </Wrapper>,
  );

  expect(setConversationSpy).toHaveBeenCalledTimes(1);
  expect(setConversationSpy).toHaveBeenCalledWith("conv_clone");

  // Toggle to configuration mode mid-session; URL conversation cleared by the
  // controller's openChat path in practice — model that here by clearing the
  // bridge state via a rerender with chatMode='configuration' and no URL id.
  mockChatMode = "configuration";
  mockRawConversationId = undefined;
  mockConversations = [{ _id: "conv_config", _creationTime: 3 }];
  rerender(
    <Wrapper>
      <CaptureContext onValue={(v) => (latest = v)} />
    </Wrapper>,
  );

  // The chatMode dep on the useEffect re-runs the effect with chatMode='configuration',
  // the early-return fires, setConversation must NOT be called again.
  expect(setConversationSpy).toHaveBeenCalledTimes(1);
  expect(latest!.routeResolution).toEqual({ status: "empty" });
});
```

The third test is the most load-bearing — it's the only one that would catch a removal of `chatMode` from the effect dep array, which is the subtle regression the fix is most exposed to.

## Implementation Steps

1. Read `apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx` in full to confirm the current mock setup (lines ~20-77) and the existing `it(...)` style.
2. Append the three new `it(...)` cases above (or close variants thereof) to the existing describe block, after the two configuration-mode tests added on this branch.
3. Run `pnpm --filter=@feel-good/mirror test:unit -- run apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx` and confirm all cases (existing + new) pass.
4. Smoke-check the regression value of test 3: temporarily remove `chatMode` from the useEffect dep array in `chat-route-controller.tsx:121-130`, rerun the test, confirm test 3 fails, revert the change.
5. Run the full `pnpm --filter=@feel-good/mirror test:unit` and `pnpm --filter=@feel-good/mirror lint` to confirm no collateral breakage.

## Out of Scope

- Adding tests for `useAgentIntentWatcher` — those belong with FG_262 (the watcher gate). This ticket is route-controller tests only.
- Refactoring the existing tests in the file — the mock shape and `Wrapper`/`CaptureContext` pattern stay as-is.
- Adding e2e Playwright coverage for the configuration-chat flow — out of scope here; route-controller unit tests are the right layer for these specific invariants.

## Resources

- `apps/mirror/app/[username]/_providers/__tests__/chat-route-controller.test.tsx` — the test file being extended (lines 270–304 are the two tests added on this branch; the new cases append after).
- `apps/mirror/app/[username]/_providers/chat-route-controller.tsx:107-150` — the SUT for which these tests pin the invariants.
- `workspace/lessons.md` (2026-05-22) — explicitly asks for "both halves" of the auto-select pinned; this ticket extends to the three protective invariants beyond the two halves.
- Code review report on `hpark0011/post-edit-route-error` — Findings #4, #5, #6 (all P2, tests reviewer).
