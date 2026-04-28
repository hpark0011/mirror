---
id: FG_076
title: "Desktop workspace shell delegates panel behavior to focused hooks"
date: 2026-04-23
type: refactor
status: completed
priority: p2
description: "apps/mirror/app/[username]/_components/desktop-workspace.tsx is 238 lines and owns five unrelated concerns in one component: collapse/expand state, navigation coordination with perf marks, panel toggle policy, resize-handle pointer interception, and imperative route-to-panel layout sync. Toggle policy is duplicated between toggleContentPanel and handleResizePointerDownCapture, and the 50/50 layout constant is hard-coded in four places. Decompose into focused hooks so each concern is independently testable and the shell component reads as a layout spec."
dependencies:
  - FG_075
parent_plan_id:
acceptance_criteria:
  - "wc -l apps/mirror/app/[username]/_components/desktop-workspace.tsx returns a value under 120"
  - "At least two new hook files exist under apps/mirror/app/[username]/_components/ (e.g. use-content-panel-controller.ts, use-interaction-panel-controller.ts) OR under apps/mirror/app/[username]/_hooks/ with distinct responsibilities"
  - "grep -c '\\[50, 50\\]' apps/mirror/app/[username]/_components/desktop-workspace.tsx returns 0 (the literal moves to a named constant used via reference)"
  - "grep -cE 'useCallback\\(' apps/mirror/app/[username]/_components/desktop-workspace.tsx returns 2 or fewer"
  - "grep -cE 'useRef\\(' apps/mirror/app/[username]/_components/desktop-workspace.tsx returns 1 or fewer (the ResizablePanelGroup ref for layout reset is acceptable; state-mirror refs move into the extracted hooks)"
  - "git diff -- apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx is empty (WorkspaceChromeContextValue shape unchanged)"
  - "git diff -- apps/mirror/app/[username]/_components/workspace-shell.tsx is empty OR only touches imports (DesktopWorkspace props unchanged)"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
  - "Manual Chrome MCP interaction verifies: (a) toggle collapses and expands the content panel on an article route, (b) toggle on an empty profile route triggers the default-content navigation, (c) toggle collapses and expands the interaction panel, (d) dragging the resize handle while either panel is collapsed expands it back to 50/50 without a second navigation"
owner_agent: "general-purpose"
---

# Desktop workspace shell delegates panel behavior to focused hooks

## Context

`apps/mirror/app/[username]/_components/desktop-workspace.tsx` is 238 lines (`wc -l`) and exceeds the ~100-line ceiling in `.claude/rules/react-components.md`. It owns five unrelated concerns in one component:

1. **Collapse/expand state** (lines 49-69) — two `useState` + four `useCallback` that mirror the imperative panel API.
2. **Navigation coordination + perf marks** (lines 71-77) — `openDefaultContentRoute` sets a pending-nav ref, fires `markContentPanelOpenStart`, and calls `onOpenDefaultContent`.
3. **Panel toggle policy** (lines 79-102) — `toggleContentPanel` and `toggleInteractionPanel` decide "if collapsed: open route or setLayout, else collapse."
4. **Resize-handle pointer interception** (lines 104-132) — duplicates the toggle policy for drag-to-open, with branching on which panel is collapsed.
5. **Imperative route-to-panel sync** (lines 134-150) — `useLayoutEffect` compares `previousHasContentRouteRef` against current to drive `.collapse()` or `setLayout([50, 50])`.

Concrete legibility costs:

- **Duplicated policy.** `toggleContentPanel` (lines 79-93) and `handleResizePointerDownCapture` (lines 104-132) implement the same "if collapsed → open default route or setLayout" rule with subtly different control flow. Any future change requires editing both.
- **Magic layout.** `[50, 50]` appears 4× (lines 88, 97, 110, 126, 145). Changing the split ratio means four edits.
- **Three-way state sync.** The panel library owns one collapse truth (`contentPanelRef.current?.collapse()`), React state owns another (`isContentPanelCollapsed`), and the `hasContentRoute` prop is a third signal that the `useLayoutEffect` reconciles. Classic drift source.
- **Refs-as-state.** `isPendingNavigationRef` (tracked by FG_075) and `previousHasContentRouteRef` bypass React's reactivity; any read-after-write assumption is fragile.

The single consumer is `apps/mirror/app/[username]/_components/workspace-shell.tsx:86-93`, which passes `hasContentRoute`, `onOpenDefaultContent`, `interaction`, and `children`. The context the component publishes is `WorkspaceChromeContextValue` in `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`; that shape must remain stable.

## Goal

`desktop-workspace.tsx` reads as a layout spec: providers, panel JSX, and delegation to hooks. Each extracted hook owns one concern, is independently testable, and collapses the duplication between the toggle handler and the resize-handle pointer-down interceptor.

## Scope

- Extract a `useContentPanelController` hook that owns: the content panel ref, its collapsed state, the pending-navigation signal (coordinated with FG_075), the perf-mark calls, the route-to-panel `useLayoutEffect`, and the toggle policy. Returns the context-compatible shape.
- Extract a `useInteractionPanelController` hook that owns: the interaction panel ref, its collapsed state, and the toggle policy. Returns the context-compatible shape.
- Extract a `useResizeHandleExpand` hook (or inline helper) that composes the two controllers and returns the pointer-down capture handler — so the drag-to-open policy is implemented exactly once and delegates to each controller's expand primitive.
- Move `[50, 50]` to a named constant (e.g., `OPEN_LAYOUT`) at module scope or in a shared layout-constants module. Reference it everywhere the split is used.
- Reduce `desktop-workspace.tsx` to a thin composition root that reads `hasContentRoute`/`onOpenDefaultContent`, calls the two hooks, builds the context value from their returns, and renders the `ResizablePanelGroup` JSX.
- Preserve the current `WorkspaceChromeContextValue` shape exactly; `workspace-shell.tsx` and all consumers of `useWorkspaceChrome` continue to work unchanged.

## Out of Scope

- Collapsing the three-way source of truth for panel state (panel library + React state + `hasContentRoute` prop) into one. That is a heavier refactor — evaluate in a follow-up if the sync effect still feels fragile after this ticket.
- Changing the `onOpenDefaultContent` prop contract or the `workspace-shell.tsx` caller.
- Touching `mobile-workspace.tsx` or the mobile-specific layout.
- Modifying the perf-mark pipeline in `lib/perf/content-panel-open.ts`.
- Fixing the pending-navigation stuck-state (handled by FG_075). This ticket depends on FG_075 shipping first so the extraction preserves the fix rather than re-introducing the bug.

## Approach

Landing order after FG_075:

1. Identify the seams by re-reading the file with the three concerns in mind (content controller / interaction controller / resize-handle composer).
2. Extract `useInteractionPanelController` first — it is the simpler of the two (no navigation, no perf marks, no layout effect) and de-risks the hook shape.
3. Extract `useContentPanelController` — includes the pending-nav signal (post-FG_075), the perf marks, and the layout effect. This hook's return shape should include both an `expand()` primitive (used by the resize-handle composer) and the full context fragment.
4. Replace the inline resize-handle pointer-down handler with a composed `useResizeHandleExpand(contentController, interactionController)` that calls each controller's `expand()` primitive — the duplication between `toggleContentPanel` and the current `handleResizePointerDownCapture` disappears.
5. Move `[50, 50]` to `const OPEN_LAYOUT = [50, 50] as const` — at module scope if only used here, or shared if `mobile-workspace` or another file would benefit.
6. Compose everything in the slimmed `DesktopWorkspace`.

Behavior must not change. Each hook's unit test (if added) should exercise the toggle/expand primitive directly without rendering the `ResizablePanelGroup`. If hooks are hard to test in isolation because they depend on the imperative panel ref, a mock ref shim is acceptable.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Ship FG_075 first and rebase this work on top so the pending-navigation fix is preserved through the extraction.
2. Create `apps/mirror/app/[username]/_components/use-interaction-panel-controller.ts` (or hoist to a new `_hooks/` dir if preferred) containing the interaction panel ref, `isInteractionPanelCollapsed` state, `onCollapse`/`onExpand` handlers, and `toggleInteractionPanel`. Return `{ ref, isCollapsed, onCollapse, onExpand, toggle, expand }` where `expand` calls `setLayout(OPEN_LAYOUT)` via an injected group ref or callback.
3. Create `apps/mirror/app/[username]/_components/use-content-panel-controller.ts` containing the content panel ref, collapsed state, pending-navigation signal (per FG_075), perf-mark calls, `toggleContentPanel`, `expand`, and the route-to-panel `useLayoutEffect`. Same return shape plus whatever extra is needed for perf marks.
4. Replace the inline `handleResizePointerDownCapture` with a shared helper or hook that calls each controller's `expand()` primitive. Assert there is exactly one implementation of the drag-to-open policy.
5. Add `const OPEN_LAYOUT = [50, 50] as const` at module scope (in whichever module owns the layout constant) and replace all four literal `[50, 50]` call sites with `OPEN_LAYOUT`.
6. Slim `desktop-workspace.tsx` to: imports, the two hook calls, the `useMemo` for `workspaceChromeValue`, and the JSX. Confirm `wc -l` reports under 120.
7. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
8. Verify in Chrome MCP per `.claude/rules/verification.md` Tier 4 using the four manual checks in the acceptance criteria (content toggle on article route, toggle on empty profile route triggering navigation, interaction toggle, drag-to-expand on each collapsed panel).

## Constraints

- `WorkspaceChromeContextValue` in `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx` must be byte-identical before and after — no field renames, no optional flags, no shape widening.
- `DesktopWorkspaceProps` must not change; `workspace-shell.tsx` should not need edits beyond possibly an import path.
- Each extracted hook file must respect the spirit of the ~100-line ceiling in `.claude/rules/react-components.md`. If a hook still exceeds ~120 lines, decompose further.
- No `setTimeout` for rendering timing (per `.claude/rules/react-components.md`).
- The pending-navigation fix from FG_075 must be preserved — do not regress the bug during extraction.
- If extracting to `_hooks/`, follow `.claude/rules/file-organization.md` (hooks live in `hooks/` inside a feature; for app-level shell code, a sibling `_hooks/` under `app/[username]/` is acceptable — match whatever pattern is already established in this route).

## Resources

- File under refactor: `apps/mirror/app/[username]/_components/desktop-workspace.tsx` (238 lines)
- Single consumer: `apps/mirror/app/[username]/_components/workspace-shell.tsx:86-93`
- Context contract to preserve: `apps/mirror/app/[username]/_providers/workspace-chrome-context.tsx`
- Perf pipeline used by the content controller: `apps/mirror/lib/perf/content-panel-open.ts`
- Related fix (must land first): `workspace/tickets/to-do/FG_075-p2-desktop-workspace-pending-nav-ref-stuck.md`
- Companion refactor precedent: `workspace/tickets/completed/FG_069-p1-split-use-chat-hook.md`
- Conventions: `.claude/rules/react-components.md`, `.claude/rules/file-organization.md`
- Verification protocol: `.claude/rules/verification.md` Tier 4
