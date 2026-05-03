---
id: FG_123
title: "Clone-settings panel unit tests find the portaled Save button via a wrapped render helper"
date: 2026-05-03
type: fix
status: completed
priority: p2
description: "After the toolbar refactor, CloneSettingsPanel renders the Save button into a portal that requires ToolbarSlotProvider to be mounted; the existing bun:test unit tests render without the provider so they would now fail to find the Save button."
dependencies: []
acceptance_criteria:
  - "apps/mirror/features/clone-settings/__tests__/clone-settings-panel.test.tsx wraps each render call with a helper that mounts ToolbarSlotProvider + ToolbarSlotTarget alongside the component"
  - "All three tests in clone-settings-panel.test.tsx find the Save button via screen.getByRole('button', { name: /save/i }) without throwing"
  - "Either bun:test is wired into a runnable script in apps/mirror/package.json, or vitest is unblocked for this file (one of the two — pick the path that matches repo intent)"
  - "The chosen runner executes the file successfully (commands documented in the ticket resolution comment)"
  - "pnpm build --filter=@feel-good/mirror passes"
owner_agent: "Frontend test engineer (React Testing Library, bun:test or vitest)"
---

# Clone-settings panel unit tests find the portaled Save button via a wrapped render helper

## Context

Surfaced by `/review-code` on branch `refactor-workspace-toolbar`.

The refactor moved the Save button out of `<CloneSettingsPanel>`'s React tree and into a `WorkspaceToolbar` portal:

- `apps/mirror/components/workspace-toolbar-slot.tsx:64` — `WorkspaceToolbar` returns `null` when `ctx.portalTarget` is null
- `apps/mirror/features/clone-settings/__tests__/clone-settings-panel.test.tsx:36-85` — three `it()` blocks all call `render(<CloneSettingsPanel />)` directly, with no `ToolbarSlotProvider` wrapper

After the refactor, every `screen.getByRole("button", { name: /save/i })` call in those tests will fail (button not in JSDOM tree). The tests assert on:

- UT-14: Save button enabled when not submitting
- UT-15 / FR-13: Save button disabled while mutation pending
- FR-11: Form submits `{ tonePreset, personaPrompt, topicsToAvoid }` payload

Compounding factor: the file is currently excluded from `vitest.config.ts:13-14` and uses `bun:test`, but `apps/mirror/package.json` has only `test:unit: vitest run` — no `bun:test` runner script. So the tests are dormant in CI today. The break is silent.

This ticket is P2 (not P1) precisely because the tests don't run in CI, but the broken test contract is technical debt that should be fixed before someone manually runs `bun test` and gets confused.

## Goal

The clone-settings panel unit tests render the component with the portal infrastructure mounted, so the Save button is findable; the tests are runnable via either bun:test or vitest with a documented command.

## Scope

- Add a small `renderWithToolbarSlot` helper in the test file (or a shared `apps/mirror/test-utils/` module) that wraps `render` with `<ToolbarSlotProvider><ToolbarSlotTarget />{children}</ToolbarSlotProvider>`
- Update all three `render(<CloneSettingsPanel />)` calls to use the helper
- Decide whether to migrate to vitest (remove from `vitest.config.ts` exclude list) or add a `bun:test` runner script — discuss with codeowner first

## Out of Scope

- Other excluded test files (`char-counter-textarea.test.tsx`, `clear-all-dialog.test.tsx`, `tone-preset-select.test.tsx`, `mobile-workspace.test.tsx`) — they have separate `bun:test` migration considerations
- Changing the production `CloneSettingsPanel` component
- Adding new test coverage beyond restoring the existing assertions

## Approach

Add a render helper inline at the top of the test file:

```ts
function renderWithToolbarSlot(ui: React.ReactElement) {
  return render(
    <ToolbarSlotProvider>
      <ToolbarSlotTarget />
      {ui}
    </ToolbarSlotProvider>
  );
}
```

Replace the three `render(<CloneSettingsPanel />)` with `renderWithToolbarSlot(<CloneSettingsPanel />)`. Verify the Save button is found.

For the runner question: this is a discussion item with the codeowner. The simplest path is migrating to vitest (remove from exclude list, replace `bun:test` imports with `vitest`). The mocking API differs — `bun:test`'s `mock.module` would become `vi.mock`. Document the chosen path in the ticket resolution.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/features/clone-settings/__tests__/clone-settings-panel.test.tsx` and the `WorkspaceToolbar`/`ToolbarSlotProvider` exports in `apps/mirror/components/workspace-toolbar-slot.tsx`
2. Add a `renderWithToolbarSlot` helper at the top of the test file
3. Replace the three `render(...)` call sites with `renderWithToolbarSlot(...)`
4. Decide: migrate to vitest (remove from exclude, port mock API) OR add a `bun:test` runner script. Confirm with codeowner before making the change
5. If migrating to vitest: replace `import { describe, expect, it, mock, beforeEach } from "bun:test"` with `import { describe, expect, it, beforeEach, vi } from "vitest"` and replace `mock.module` with `vi.mock`
6. Run the chosen runner: `pnpm test:unit` (vitest) OR `pnpm exec bun test apps/mirror/features/clone-settings/__tests__/clone-settings-panel.test.tsx` (bun)
7. All three tests must pass
8. Run `pnpm build --filter=@feel-good/mirror` to confirm no type regression

## Constraints

- Do not delete the tests; they cover real invariants (FR-11, FR-13)
- Do not weaken assertions during the migration — preserve the disabled-state and payload-shape checks
- Coordinate the runner-choice decision before merging the test changes

## Resources

- `apps/mirror/components/workspace-toolbar-slot.tsx` — `ToolbarSlotProvider` and `ToolbarSlotTarget` exports
- `apps/mirror/vitest.config.ts:13-14` — current exclusion list
- Originating review: `/review-code` output on branch `refactor-workspace-toolbar`

## Resolution

- Runner: migrated this file to vitest (matches the existing `pnpm test:unit` script and scopes the change to one file rather than reviving all five dormant `bun:test` files).
- `bun:test` API → vitest API: `mock` → `vi.fn`, `mock.module` → `vi.mock`.
- Added `renderWithToolbarSlot` helper that wraps `<ToolbarSlotProvider><ToolbarSlotTarget />…</ToolbarSlotProvider>` so the portaled Save button is in the JSDOM tree.
- Added `afterEach(cleanup)` because `vitest.config.ts` does not set `globals: true`, so RTL's auto-cleanup is not registered; without this the second `it()` block sees two Save buttons and `getByRole` throws on multiple matches.
- Removed `features/clone-settings/__tests__/clone-settings-panel.test.tsx` from `vitest.config.ts` exclude list. The other four `bun:test` files stay excluded — out of scope for this ticket.

**Verification commands:**
- `pnpm --filter=@feel-good/mirror exec vitest run features/clone-settings/__tests__/clone-settings-panel.test.tsx` — 3/3 passed.
- `pnpm --filter=@feel-good/mirror build` — passed.
- Pre-existing failures in `app/[username]/_components/__tests__/desktop-workspace.test.tsx` (`useProfileRouteData must be used within ProfileRouteDataProvider`) reproduce on the unmodified branch tip and are out of scope.
