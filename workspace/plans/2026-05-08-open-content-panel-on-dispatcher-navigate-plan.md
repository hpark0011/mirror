---
id: PLAN_010
slug: open-content-panel-on-dispatcher-navigate
title: "Open content panel on dispatcher navigate (close the agent-UI parity gap)"
date: 2026-05-08
type: fix
status: draft
branch: feature-open-content-panel
worktree: .worktrees/feature-open-content-panel/
scope: "Make useCloneActions guarantee the desktop content panel is expanded on every navigate, so agent-driven (and user-UI) navigation between content URLs re-opens a manually-collapsed panel."
apps: [mirror]
verification_tier: 5
predecessor: PLAN_005
---

## 1. Summary

Today the clone agent can correctly resolve a content slug, build the canonical
href, and dispatch `useCloneActions().navigateToContent(...)` — but if the
visitor has manually collapsed the content panel while still on a content URL
(e.g. `/@han/posts?chat=1&conversation=…`), the panel stays collapsed after the
agent's `router.push`. The chat reads "Just opened it on the right" while the
right panel is invisible. Same gap exists for user-UI clicks on profile tabs
or list items while the panel is collapsed.

Root cause: `useCloneActions().navigateToContent` and `navigateToProfileSection`
only call `router.push`. The auto-expand lives one layer below in
`useContentPanelController`'s `useLayoutEffect`, which only fires on the
**boolean transition** `hasContentRoute: false → true`. When both the previous
and next URLs pass `isProfileTabKind`, the transition guard short-circuits and
the panel never re-opens.

This plan fixes the gap **at the dispatcher** so both routes — agent and
user-UI — get the guarantee. We add a thin "panel bridge" context above
`CloneActionsProvider`, `DesktopWorkspace` registers an imperative
`ensureExpanded` callback, and the dispatcher calls
`ensureContentPanelOpen()` before every `router.push`. Mobile is route-driven
so the bridge is a no-op there; mobile chat-while-content UX is out of scope
(see § 6).

This is the compounding option per `AGENTS.md` § Core Principles: it preserves
"two routes, one dispatcher" (`.claude/rules/agent-parity.md`), patches the
upstream artifact (the dispatcher) instead of the downstream symptom (the
chat experience), and gives any future "navigate-and-also-open-the-panel"
verb a single attachment point.

## 2. Background — current state

- `useCloneActions` (`apps/mirror/app/[username]/_providers/clone-actions-context.tsx`)
  exposes two verbs that the agent intent watcher and the user-UI list
  items / profile tabs all funnel through:
  - `navigateToContent({ kind, slug, href? })`
  - `navigateToProfileSection({ section, href? })`
  Both call `router.push(buildChatAwareHref(basePath), { scroll: false })`
  and nothing else.
- `WorkspaceChromeProvider`
  (`apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`)
  is mounted **inside** `DesktopWorkspace` / `MobileWorkspace`, which are
  rendered by `WorkspaceShell` — i.e. **below** `CloneActionsProvider` in
  `app/[username]/layout.tsx:92`. The dispatcher therefore cannot read or
  invoke `useWorkspaceChrome()` directly.
- `useContentPanelController`
  (`apps/mirror/app/[username]/_hooks/use-content-panel-controller.ts:88-103`)
  auto-expands via:
  ```ts
  useLayoutEffect(() => {
    const previousHasContentRoute = previousHasContentRouteRef.current;
    previousHasContentRouteRef.current = hasContentRoute;
    if (previousHasContentRoute === hasContentRoute) return;  // ← bug surface
    ...
    if (hasContentRoute) {
      groupRef.current?.setLayout([...OPEN_LAYOUT]);
      return;
    }
    panelRef.current?.collapse();
  }, [groupRef, hasContentRoute, pendingNav]);
  ```
  When the URL pivots between two content routes (e.g. `/@han/posts?…`
  → `/@han/articles/foo?…`), `hasContentRoute` stays `true`, the guard returns
  early, and `setLayout([...OPEN_LAYOUT])` never fires.
- `useContentPanelController.expand()` already exists, but its third branch
  falls back to `openDefaultContentRoute()` (`router.push('/@user/posts')`)
  when `!hasContentRoute`. Calling it from the dispatcher would race the
  dispatcher's own `router.push` to a more specific content URL. The agent
  case requires "force-expand without fallback nav" — a distinct verb.
- `MobileWorkspace`
  (`apps/mirror/app/[username]/_components/mobile-workspace.tsx`) derives
  `isContentPanelCollapsed: !hasContentRoute` directly from the route — there
  is no orthogonal "user collapsed via toggle" state. Mobile is route-driven
  by construction, so the dispatcher's `router.push` already does the right
  thing. Mobile content-vs-chat-overlay UX is a separate question (§ 6).

## 3. Compounding rationale

Three options were on the table:

| Option | Where the fix lives | Compounding? |
|---|---|---|
| (A) **Bridge context above `CloneActionsProvider`; dispatcher calls `ensureContentPanelOpen()`** | Both routes (agent + user-UI) | **Yes** — single attachment point; preserves "two routes, one dispatcher"; closes the parity gap at the verb level |
| (B) Loosen the layout effect's transition guard to also expand on URL change while collapsed | `useContentPanelController` | No — re-expands every back-button navigation, every middleware redirect, every chat-aware-href rewrite. Fights user intent. |
| (C) Have `useAgentIntentWatcher` separately call a new `expand` verb after each `navigateToContent` | Agent route only | No — duplicates the parity loop, splits routes, and doesn't fix the user-UI tab-while-collapsed case (which exists today after PLAN_005 wired tabs through the dispatcher). |

This plan picks (A). The bridge context is a thin imperative seam, not a
state container — `WorkspaceChromeProvider` keeps owning panel state. The
seam exists purely so an upstream provider (the dispatcher) can ask a
downstream provider (the chrome) to do something imperative.

## 4. Naming decisions

| Surface | Name |
|---|---|
| New context module | `apps/mirror/app/[username]/_providers/workspace-panel-bridge-context.tsx` |
| Provider component | `WorkspacePanelBridgeProvider` |
| Consumer hook | `useWorkspacePanelBridge` (throws when missing — same shape as `useCloneActions`) |
| Optional consumer hook | `useOptionalWorkspacePanelBridge` (returns `null`) — used only by tests / fallback paths |
| Imperative methods | `register(fn: () => void) => () => void` (returns unregister) and `ensureContentPanelOpen(): void` |
| New controller method | `ensureExpanded(): void` on `ContentPanelController` |

`ensureContentPanelOpen` (verb-on-the-bridge) and `ensureExpanded`
(method-on-the-controller) are deliberately distinct names so a code search
disambiguates "who is asking" from "who is acting." The bridge is a thin
indirection; the controller is the actor.

## 5. Implementation steps (in order)

> Cross-reference: `.claude/rules/agent-parity.md` § "Two routes, one
> dispatcher" — we are NOT adding a new agent verb. Steps 1–3 are infra;
> Step 4 is the dispatcher patch; Steps 5–6 are wiring; Step 7 is tests.

### Step 1 — Create the panel-bridge context

**File:** `apps/mirror/app/[username]/_providers/workspace-panel-bridge-context.tsx` (new)

Shape:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type WorkspacePanelBridgeContextValue = {
  /**
   * Workspace-side handlers register an imperative "ensure the content
   * panel is open" callback. Returns an unregister cleanup.
   *
   * Only one callback is active at a time. The current registrant wins —
   * a re-registration overwrites. Desktop registers; mobile does not.
   */
  register: (fn: () => void) => () => void;
  /**
   * Dispatcher-side callers ask the bridge to open the content panel
   * before navigating. No-op when no callback is registered (mobile,
   * SSR, tests with no workspace mounted).
   */
  ensureContentPanelOpen: () => void;
};

const WorkspacePanelBridgeContext =
  createContext<WorkspacePanelBridgeContextValue | null>(null);

export function useOptionalWorkspacePanelBridge() {
  return useContext(WorkspacePanelBridgeContext);
}

export function useWorkspacePanelBridge() {
  const ctx = useOptionalWorkspacePanelBridge();
  if (!ctx) {
    throw new Error(
      "useWorkspacePanelBridge must be used within WorkspacePanelBridgeProvider",
    );
  }
  return ctx;
}

export function WorkspacePanelBridgeProvider({
  children,
}: { children: ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null);

  const register = useCallback((fn: () => void) => {
    handlerRef.current = fn;
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const ensureContentPanelOpen = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const value = useMemo<WorkspacePanelBridgeContextValue>(
    () => ({ register, ensureContentPanelOpen }),
    [register, ensureContentPanelOpen],
  );

  return (
    <WorkspacePanelBridgeContext.Provider value={value}>
      {children}
    </WorkspacePanelBridgeContext.Provider>
  );
}
```

Comment block at the top of the file MUST cite:
- `.claude/rules/agent-parity.md` § "Two routes, one dispatcher" as the rule
  this satisfies.
- `apps/mirror/app/[username]/_providers/clone-actions-context.tsx` and
  `apps/mirror/app/[username]/_components/desktop-workspace.tsx` as the two
  consumers.
- "Mobile does not register — content visibility is route-driven via
  `MobileWorkspace`'s `isChatOpen || !hasContentRoute` render branch." as
  the platform carveout.

### Step 2 — Add `ensureExpanded` to the content panel controller

**File:** `apps/mirror/app/[username]/_hooks/use-content-panel-controller.ts`

- Add a new method to `ContentPanelController`:
  ```ts
  /**
   * Imperative "if collapsed, open without falling back to default-content
   * navigation." Distinct from `expand()` because the caller (the dispatcher)
   * is itself about to `router.push` to a specific content URL — falling back
   * to `openDefaultContentRoute()` would race that push.
   */
  ensureExpanded: () => void;
  ```
- Implementation:
  ```ts
  const ensureExpanded = useCallback(() => {
    if (!isCollapsed) return;
    if (pendingNav.isArmed()) return;
    groupRef.current?.setLayout([...OPEN_LAYOUT]);
  }, [groupRef, isCollapsed, pendingNav]);
  ```
- Add `ensureExpanded` to the returned tuple. Comment beside the new method
  cross-references `clone-actions-context.tsx` as the caller and notes the
  intentional difference vs. `expand()`.

### Step 3 — Mount the bridge provider above `CloneActionsProvider`

**File:** `apps/mirror/app/[username]/layout.tsx`

```tsx
import { WorkspacePanelBridgeProvider } from "./_providers/workspace-panel-bridge-context";
…
<ProfileRouteDataProvider …>
  <WorkspacePanelBridgeProvider>
    <CloneActionsProvider>
      <ChatRouteController>
        <WorkspaceShell interaction={interaction} content={content} />
      </ChatRouteController>
    </CloneActionsProvider>
  </WorkspacePanelBridgeProvider>
</ProfileRouteDataProvider>
```

The bridge is **outside** `ChatRouteController` and **outside**
`CloneActionsProvider` so any future expansion (e.g. a new dispatcher verb)
can also opt into the panel guarantee.

### Step 4 — Patch the dispatcher

**File:** `apps/mirror/app/[username]/_providers/clone-actions-context.tsx`

- Import `useWorkspacePanelBridge`.
- Read `ensureContentPanelOpen` from the bridge in `CloneActionsProvider`.
- In **both** `navigateToContent` and `navigateToProfileSection`, call
  `ensureContentPanelOpen()` **before** `router.push(...)`:
  ```ts
  const navigateToContent = useCallback<CloneActions["navigateToContent"]>(
    ({ kind, slug, href }) => {
      ensureContentPanelOpen();
      const basePath = href ?? getContentHref(profile.username, kind, slug);
      router.push(buildChatAwareHref(basePath), { scroll: false });
    },
    [router, profile.username, buildChatAwareHref, ensureContentPanelOpen],
  );

  const navigateToProfileSection = useCallback<
    CloneActions["navigateToProfileSection"]
  >(
    ({ section, href }) => {
      ensureContentPanelOpen();
      const basePath = href ?? getProfileTabHref(profile.username, section);
      router.push(buildChatAwareHref(basePath), { scroll: false });
    },
    [router, profile.username, buildChatAwareHref, ensureContentPanelOpen],
  );
  ```
- Update the JSDoc block at the top of the file to add a third bullet:
  > Both verbs call `ensureContentPanelOpen()` from the workspace panel
  > bridge before pushing — guarantees a manually-collapsed panel re-opens
  > on every dispatcher navigation, regardless of whether `hasContentRoute`
  > transitions. Closes the parity gap noted in the FG_???-style ticket
  > attached to PLAN_010.

### Step 5 — Desktop registration

**File:** `apps/mirror/app/[username]/_components/desktop-workspace.tsx`

- Import `useWorkspacePanelBridge`.
- Inside `DesktopWorkspace`, after the controllers are constructed:
  ```ts
  const { register } = useWorkspacePanelBridge();
  useEffect(() => {
    return register(contentController.ensureExpanded);
  }, [register, contentController.ensureExpanded]);
  ```
- Comment above the effect cites the bridge and notes that mobile
  intentionally does not register (route-driven).
- Component stays under 100 lines (per `.claude/rules/react-components.md`);
  if the constraint is violated, extract the registration into a tiny custom
  hook `useRegisterContentPanelBridge(contentController)` in `_hooks/`.

### Step 6 — Mobile no-op

**File:** `apps/mirror/app/[username]/_components/mobile-workspace.tsx`

- **No change required.** Mobile does not register a callback. The bridge's
  `ensureContentPanelOpen` becomes a no-op when the app is mobile, which is
  correct — `MobileWorkspace` derives panel visibility from the route
  (`isContentPanelCollapsed: !hasContentRoute`). The dispatcher's `router.push`
  alone is enough to flip the route and the mobile renderer's
  `isChatOpen || !hasContentRoute ? interaction : children` branch handles
  the visual swap.
- Add a one-line comment in `MobileWorkspace` next to the chrome-value memo
  noting "Mobile does not register with `WorkspacePanelBridgeProvider` —
  panel visibility is route-driven."

### Step 7 — Tests

#### 7a. Unit: bridge context

**File:** `apps/mirror/app/[username]/_providers/__tests__/workspace-panel-bridge-context.test.tsx` (new)

Cover:

1. `ensureContentPanelOpen()` is a no-op when nothing is registered.
2. `register(fn)` makes `ensureContentPanelOpen()` invoke `fn` exactly once
   per call.
3. Re-registering with a new `fn'` overwrites the previous registration —
   subsequent `ensureContentPanelOpen()` calls hit `fn'`, not `fn`.
4. The cleanup returned by `register(fn)` only clears the slot if `fn` is
   still the active registrant. If `fn` was already overwritten by `fn'`
   before cleanup runs, the cleanup does NOT clear `fn'`. (Guards against
   the React StrictMode double-mount cleanup foot-gun where stale cleanup
   clobbers a fresh registration.)
5. `useWorkspacePanelBridge()` throws outside a provider.
6. `useOptionalWorkspacePanelBridge()` returns `null` outside a provider.

#### 7b. Unit: controller `ensureExpanded`

**File:** `apps/mirror/app/[username]/_hooks/__tests__/use-content-panel-controller.test.ts` (new — directory does not exist yet)

Stub the resizable-panel module the way `desktop-workspace.test.tsx` already
does (`vi.mock` returns a controllable `Panel`/`PanelGroup`/`Handle`). Cover:

1. **Collapsed + content route present** → `ensureExpanded()` calls
   `groupRef.current.setLayout([50, 50])` exactly once.
2. **Already expanded** → `ensureExpanded()` is a no-op (no `setLayout` call).
3. **`pendingNav.isArmed() === true`** → `ensureExpanded()` is a no-op.
4. **`!hasContentRoute`** → `ensureExpanded()` still calls `setLayout([50, 50])`
   and does **not** call `openDefaultContentRoute()`. The dispatcher is
   responsible for the upcoming navigation; the controller must not double-push.
   This is the load-bearing assertion for the "distinct verb" decision in
   Step 2.

#### 7c. Unit: dispatcher calls the bridge

**File:** `apps/mirror/app/[username]/_providers/__tests__/clone-actions-context.test.tsx`

Extend the existing test setup with a `useWorkspacePanelBridge` mock:

```ts
const ensureContentPanelOpenSpy = vi.fn();
vi.mock(
  "@/app/[username]/_providers/workspace-panel-bridge-context",
  () => ({
    useWorkspacePanelBridge: () => ({
      register: vi.fn(() => () => {}),
      ensureContentPanelOpen: ensureContentPanelOpenSpy,
    }),
    WorkspacePanelBridgeProvider: ({ children }: { children: ReactNode }) =>
      children,
  }),
);
```

Add new `describe("CloneActionsProvider — panel-bridge integration (PLAN_010)")`
block asserting:

1. `navigateToContent({…, href})` (agent path) calls `ensureContentPanelOpen`
   **before** `router.push`. Use `mock.invocationCallOrder` to pin ordering:
   ```ts
   expect(ensureContentPanelOpenSpy.mock.invocationCallOrder[0])
     .toBeLessThan(pushSpy.mock.invocationCallOrder[0]);
   ```
2. `navigateToContent({…})` (user-UI path, `href` omitted) — same ordering.
3. `navigateToProfileSection({section, href})` — same ordering, all four
   sections (`bio | articles | posts | clone-settings`).
4. `navigateToProfileSection({section})` (user-UI) — same ordering.
5. The chat-aware suffix preservation tests already in the file MUST still
   pass — assert `ensureContentPanelOpen` is called regardless of the
   `isChatOpen` toggle. (Two cases: open + closed.)

#### 7d. Unit: desktop workspace registers the bridge

**File:** `apps/mirror/app/[username]/_components/__tests__/desktop-workspace.test.tsx`

Add a `describe("DesktopWorkspace — panel-bridge registration (PLAN_010)")`
block. Render `DesktopWorkspace` inside a `WorkspacePanelBridgeProvider`,
spy on `register`, and assert:

1. On mount, `register(fn)` is called exactly once. The `fn` argument equals
   the controller's `ensureExpanded` reference.
2. Calling the bridge's `ensureContentPanelOpen()` — exposed via a sibling
   harness component that consumes the same provider — invokes
   `groupRef.setLayout([50, 50])` on the mocked `PanelGroup` (proves the
   end-to-end imperative loop wires through).
3. On unmount, the `register` cleanup runs and a subsequent
   `ensureContentPanelOpen()` is a no-op (no `setLayout` call).

These tests anchor the wiring contract — the controller's `ensureExpanded`
identity must remain stable across the lifecycle of the component for the
`register` call to behave as expected.

### Step 8 — Cross-ref comments & docs cleanup

- In `clone-actions-context.tsx`: add a one-line comment near the
  `ensureContentPanelOpen()` call sites: `// PLAN_010 — both routes funnel
  through the bridge; mobile no-ops by construction.`
- Update `.claude/rules/agent-parity.md` § "Two routes, one dispatcher" with
  a short note: every dispatcher verb that pushes a content URL MUST call
  `ensureContentPanelOpen()` before `router.push`. Add a sentence at the
  bottom of that subsection:
  > **Panel-open invariant.** Both routes funnel through the dispatcher,
  > and the dispatcher's contract includes "the content panel is visible
  > after navigation." `useCloneActions` calls `ensureContentPanelOpen()`
  > from `WorkspacePanelBridgeProvider` before every `router.push`. New
  > dispatcher verbs that target content URLs MUST do the same.
- No change to `.claude/rules/state-management.md` — the bridge is React
  Context (Tier 3 of the decision tree, the documented choice for DI). The
  callback ref inside it is a `useRef`, also blessed.

## 6. Constraints & non-goals

**Hard constraints:**

- ❌ Do **NOT** loosen the layout-effect transition guard in
  `useContentPanelController` (Option B in § 3). It would re-expand on every
  back-button navigation, every middleware redirect, and every chat-aware
  href rewrite — none of which the user asked for.
- ❌ Do **NOT** call `useCloneActions().expand()` from the dispatcher. Its
  fallback branch (`!hasContentRoute → openDefaultContentRoute()`) races the
  dispatcher's own `router.push`. Use the new `ensureExpanded` instead.
- ❌ Do **NOT** add a new agent tool. This plan does not introduce a new
  verb on the LLM-visible surface; the parity fix is in the dispatcher
  (the user-UI half of the loop already exists post-PLAN_005). If a future
  agent verb needs to "open the panel without navigating," that's a separate
  plan and the bridge already exposes the seam.
- ❌ Do **NOT** add `userId` (or any user identifier) to any tool's
  `inputSchema`. This plan does not touch tools at all, but reviewers should
  confirm the `inputSchema invariants` block in
  `packages/convex/convex/chat/__tests__/tools.test.ts` is unchanged.
- ❌ Do **NOT** lift `WorkspaceChromeProvider` itself above
  `CloneActionsProvider`. The chrome value depends on per-platform
  controllers (`useContentPanelController` etc.), which need the panel-group
  ref — that ref is fundamentally tied to the panel mount lifecycle. The
  bridge is intentionally narrower: a single imperative seam, not a state
  store.
- ❌ Do **NOT** call `ensureContentPanelOpen` from anywhere other than the
  dispatcher in this plan. List items, profile tabs, and the agent intent
  watcher already funnel through the dispatcher; reaching past the
  dispatcher would defeat "two routes, one dispatcher."

**Non-goals (explicit scope cuts):**

- 🚫 **Mobile chat-while-content UX.** On mobile, when the agent navigates
  while chat is open (`?chat=1`), `MobileWorkspace`'s
  `isChatOpen || !hasContentRoute ? interaction : children` branch keeps
  rendering the chat. The user must close chat to see the content. The
  agent's "Just opened it on the right" wording is also wrong on mobile
  (no right pane). Both are real problems but architecturally orthogonal —
  the fix is either auto-close-chat on mobile content nav or rephrase the
  agent's response based on viewport. Track separately.
- 🚫 **Persona-aware acknowledgement.** The agent says "Just opened it on
  the right" deterministically. No tone/persona changes here.
- 🚫 **Telemetry.** No instrumentation of "panel was auto-expanded by the
  bridge" — if the next plan wants this, the bridge is the single
  attachment point.
- 🚫 **Refactor of `useContentPanelController`'s layout effect.** It still
  handles the genuine `false → true` transition; we are layering on a
  second imperative trigger, not replacing the first.
- 🚫 **`useAgentIntentWatcher` change.** Watcher already funnels through
  the dispatcher; the fix lands at the dispatcher and the watcher gets it
  for free.

## 7. Hard verification

Tier 5 per `.claude/rules/verification.md` (this plan introduces a UI
contract change observable end-to-end).

```bash
pnpm --filter=@feel-good/mirror build
pnpm --filter=@feel-good/mirror lint
pnpm --filter=@feel-good/mirror test:unit -- \
  workspace-panel-bridge-context \
  use-content-panel-controller \
  clone-actions-context \
  desktop-workspace
pnpm --filter=@feel-good/mirror test:e2e content-panel-auto-expand
```

All must pass before the PR is mergeable.

### Hard verification — Playwright CLI spec

> Per `.claude/rules/verification.md`: Playwright CLI only. Chrome MCP is
> for visual debugging, not test assertions.

**File:** `apps/mirror/e2e/content-panel-auto-expand.spec.ts` (new)

Pre-conditions: `rick-rubin` seed user has at least one published article and
one published post (already true; same fixture
`profile-content-panel-toggle.spec.ts` and `chat-agent-navigates.authenticated.spec.ts`
rely on).

Use the existing helpers:
- `e2e/helpers/chat.ts` for `openChat` / `sendChatMessage` / `RECEIVED_BUBBLE_SELECTOR`.
- `data-testid="desktop-content-panel"` exposes `data-state="open" | "closed"`
  (defined in `workspace-panels.tsx:57`).
- `getByRole('button', { name: 'Hide Artifacts' | 'Show Artifacts' })` toggles
  the content panel (per `profile-content-panel-toggle.spec.ts`).

#### Test 1 — User-UI path: tab click while collapsed re-opens the panel

```ts
test("clicking a profile tab while the content panel is collapsed re-opens it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@rick-rubin/posts`);

  const contentRegion = page.getByTestId("desktop-content-panel");
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 10000 });

  // Manually collapse via the artifacts toggle.
  await page.getByRole("button", { name: "Hide Artifacts" }).click();
  await expect(contentRegion).toHaveAttribute("data-state", "closed", { timeout: 5000 });

  // Click another profile tab — URL stays in the `isProfileTabKind` set,
  // so the layout-effect transition guard does NOT fire. Without the
  // PLAN_010 fix, the panel stays collapsed forever.
  await page.getByRole("tab", { name: "Bio" }).click();

  await expect(page).toHaveURL(/\/@rick-rubin\/bio(\?|$)/);
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 5000 });
});
```

#### Test 2 — User-UI path: list-item click while collapsed re-opens the panel

```ts
test("clicking an article list item while the content panel is collapsed re-opens it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@rick-rubin/articles`);

  const contentRegion = page.getByTestId("desktop-content-panel");
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 10000 });
  await page.getByRole("button", { name: "Hide Artifacts" }).click();
  await expect(contentRegion).toHaveAttribute("data-state", "closed", { timeout: 5000 });

  // Click into an article — URL goes /@rick-rubin/articles → /@rick-rubin/articles/<slug>.
  // Both pass `isProfileTabKind`. The list-item click funnels through
  // `useCloneActions().navigateToContent`, so the bridge fires.
  const firstArticle = page
    .getByRole("link", { name: /./ })
    .filter({ hasText: /\w/ })
    .first();
  await firstArticle.click();

  await expect(page).toHaveURL(/\/@rick-rubin\/articles\/[^/?#]+/);
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 5000 });
});
```

#### Test 3 — Agent path: tool-driven navigation while collapsed re-opens the panel

This test exercises the real LLM (`*.authenticated.spec.ts`); model
`chat-agent-navigates.authenticated.spec.ts` for serial-mode + 150s timeout.

```ts
// apps/mirror/e2e/content-panel-auto-expand.authenticated.spec.ts (split file
// because it loads `e2e/.auth/user.json` storage state)
test.describe.configure({ mode: "serial", timeout: 150_000 });
const NAV_TIMEOUT = 60_000;

test("agent navigation while the content panel is collapsed re-opens it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  // openChat goes to /@rick-rubin?chat=1 → middleware redirects to
  // /@rick-rubin/posts?chat=1 → chat panel mounts → ?conversation= populates.
  const textarea = await openChat(page, "rick-rubin");

  const contentRegion = page.getByTestId("desktop-content-panel");
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 10000 });

  // Manually collapse — the bug repro starting state.
  await page.getByRole("button", { name: "Hide Artifacts" }).click();
  await expect(contentRegion).toHaveAttribute("data-state", "closed", { timeout: 5000 });

  await sendChatMessage(textarea, "show me your latest article.");

  // The agent calls getLatestPublished → navigateToContent. The watcher
  // dispatches via useCloneActions().navigateToContent. PLAN_010's bridge
  // fires inside the dispatcher, before router.push.
  await page.waitForURL(
    /\/@rick-rubin\/articles\/[^/?#]+/,
    { timeout: NAV_TIMEOUT },
  );

  // The load-bearing assertion: the panel is open after the agent navigates.
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 10000 });
  await expect(page.locator("article h1").first()).toBeVisible({ timeout: NAV_TIMEOUT });
  expect(page.url()).toMatch(/[?&]chat=1\b/);
  expect(page.url()).toMatch(/[?&]conversation=[^&]+/);
});
```

#### Test 4 — Negative regression: dispatcher does NOT clobber the user's expanded state

Make sure calling the bridge when the panel is already open is a no-op (no
flicker, no layout reset).

```ts
test("clicking a tab while the panel is already open does not flicker the layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`/@rick-rubin/posts`);

  const contentRegion = page.getByTestId("desktop-content-panel");
  const contentResizablePanel = page.locator('[data-slot="resizable-panel"]').nth(1);
  await expect(contentRegion).toHaveAttribute("data-state", "open", { timeout: 10000 });

  // Capture the user's chosen split width (drag to a non-50/50 size).
  // Reuse `dragHandleBy` from `profile-content-panel-toggle.spec.ts` —
  // promote it to `e2e/helpers/resize.ts` if it isn't already shared.
  const handle = page.locator('[data-slot="resizable-handle"]');
  await dragHandleBy(page, handle, 220);
  const widthBefore = await contentResizablePanel.evaluate((el) =>
    Math.round(el.getBoundingClientRect().width),
  );

  // Click a tab — bridge fires, but ensureExpanded is a no-op when not
  // collapsed. The user's chosen width must be preserved (not reset to 50/50).
  await page.getByRole("tab", { name: "Articles" }).click();
  await expect(page).toHaveURL(/\/@rick-rubin\/articles(\?|$)/);
  await expect(contentRegion).toHaveAttribute("data-state", "open");

  const widthAfter = await contentResizablePanel.evaluate((el) =>
    Math.round(el.getBoundingClientRect().width),
  );
  expect(Math.abs(widthAfter - widthBefore)).toBeLessThan(20);
});
```

This is the load-bearing assertion for "do no harm to a manually-resized
layout."

#### Test 5 — Mobile no-op (regression guard)

```ts
test("mobile: dispatcher navigation does not depend on the bridge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/@rick-rubin/articles`);
  await expect(page.getByRole("link", { name: /./ }).first()).toBeVisible({ timeout: 10000 });

  // Click an article. Mobile route nav drives the visual swap; the bridge
  // is unregistered on mobile. URL must still resolve to the detail page.
  const firstArticle = page
    .getByRole("link", { name: /./ })
    .filter({ hasText: /\w/ })
    .first();
  await firstArticle.click();
  await expect(page).toHaveURL(/\/@rick-rubin\/articles\/[^/?#]+/);
});
```

This proves we did not regress the mobile renderer by depending on a
bridge that mobile intentionally does not register.

**Run command** (canonical):

```bash
pnpm --filter=@feel-good/mirror test:e2e content-panel-auto-expand
```

Each assertion above is independently necessary — together they prove:
- **#1, #2** the user-UI half of the dispatcher fires the bridge,
- **#3** the agent half of the dispatcher fires the bridge,
- **#4** the bridge does not clobber a user's manually-resized layout,
- **#5** the mobile path is unaffected.

### Manual sanity check (Tier 5 supplement, not a substitute)

Use Chrome MCP at the worktree port (read `MIRROR_PORT` from
`scripts/with-worktree-port.mjs` per `.claude/rules/worktrees.md`) to:

1. Reproduce the exact bug screenshot — open Han's profile, send "what are
   your thoughts on taste?", collapse the artifacts panel mid-conversation,
   say "yes" to the agent's offer to pull up the article. Confirm the
   panel re-opens on the right.
2. Drag the resize handle to a non-50/50 width, then click another tab —
   confirm the width is preserved (Test 4 visual variant).

Both are visual confirmation only; the Playwright assertions above are the
load-bearing proof.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Calling `ensureContentPanelOpen()` before `router.push` could trigger an extra render that delays navigation. | The bridge handler is a `useRef` invocation — no React state writes, no re-render. The controller's `setLayout` call is a single synchronous imperative on the resizable-panel-group ref. Net cost: one function call per dispatcher invocation. Test #4 pins "no visible flicker." |
| `register`'s cleanup could fire after a re-registration in StrictMode dev double-mount, clobbering the live registrant. | The cleanup checks `handlerRef.current === fn` before clearing — covered by Step 7a test #4. This is the standard "stale cleanup guard" pattern. |
| Mobile silently regressing because the bridge is provided but never registered. | Test #5 explicitly exercises the mobile dispatch path. The bridge's `ensureContentPanelOpen` no-ops gracefully when no callback is registered (no exception, no warning), which is the correct mobile behavior. |
| Adding the bridge above `CloneActionsProvider` increases the number of context layers wrapping every `[username]` route. | One thin context with a single `useRef` and two memoized callbacks. Render cost is negligible; the alternatives (lifting state, lifting the panel group) are strictly more invasive. |
| The agent path in Test #3 hits the real LLM — flake risk. | Mirror `chat-agent-navigates.authenticated.spec.ts`'s pattern: serial mode, 150s describe timeout, generous `NAV_TIMEOUT`. The "show me your latest article" prompt is the same one already pinned to the navigateToContent flow, so any LLM flake here would also flake the existing agent-navigates spec. |
| The bridge's "single registrant wins" semantics could surprise a future caller registering a second handler. | Documented in Step 1's JSDoc and pinned by Step 7a test #3. If multi-handler dispatch is ever needed, expand `register` to push into an array — cheap follow-up. |

## 9. PR shape

Single PR on `feature-open-content-panel`. Commit ordering:

1. Add `WorkspacePanelBridgeProvider` + unit tests (Step 1, Step 7a).
2. Add `ensureExpanded` to `useContentPanelController` + unit tests (Step 2, Step 7b).
3. Mount the bridge in `[username]/layout.tsx` (Step 3).
4. Patch the dispatcher + extend dispatcher unit tests (Step 4, Step 7c).
5. Register from `DesktopWorkspace` + extend desktop-workspace unit tests (Step 5, Step 7d).
6. Mobile comment + no-code-change confirmation (Step 6).
7. Playwright e2e: `content-panel-auto-expand.spec.ts` and the `.authenticated.spec.ts` companion (§ 7).
8. Cross-ref + agent-parity rule update (Step 8).

Each commit MUST `pnpm --filter=@feel-good/mirror build` and `pnpm
--filter=@feel-good/mirror lint` clean. The PR description names the
agent-parity rule, links to the four-step checklist (even though no agent
verb is added), and points reviewers at Steps 7c/7d as the
parity-loop trust boundary.
