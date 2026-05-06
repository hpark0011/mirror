---
id: FG_160
title: "Editor Cancel button is disabled while saving"
date: 2026-05-06
type: improvement
status: to-do
priority: p2
description: "ArticleEditorToolbar passes disabled={isSaving} to WorkspaceBackButton at apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:32. The existing e2e test at apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92 only asserts role/aria-label, never the disabled state. If the prop wiring is dropped, Cancel becomes clickable mid-save and could trigger a conflicting navigation. Add coverage that locks in the disabled-while-saving invariant."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "A new test (or assertion within the existing editor-mode test) in apps/mirror/e2e/workspace-back-button.authenticated.spec.ts triggers a Save click in the editor and asserts await expect(back).toBeDisabled() before the save resolves; OR a focused vitest unit test covers ArticleEditorToolbar rendering with isSaving=true and verifying the back button is disabled"
  - "grep -nE 'toBeDisabled|disabled' apps/mirror/e2e/workspace-back-button.authenticated.spec.ts (or the vitest file under apps/mirror/features/articles/components/editor/__tests__/) returns at least one match in the Cancel-button context"
  - "The new test passes against the current build"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "Playwright e2e author or React unit-test author"
---

# Editor Cancel button is disabled while saving

## Context

The article editor's Cancel/back affordance is wired to disable while a save is in flight:

```tsx
// apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:29-35
{onCancel && (
  <WorkspaceBackButton
    onClick={onCancel}
    disabled={isSaving}
    ariaLabel="Cancel"
  />
)}
```

This invariant matters: clicking Cancel mid-save can trigger a navigation that races the optimistic patch + server roundtrip, leading to either lost edits or a confusing inflight state in the destination view.

The current e2e at `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92` only asserts:

```ts
await expect(back).toBeVisible({ timeout: 10_000 });
await expect(back).toHaveRole("button");
await expect(back).toHaveAccessibleName("Cancel");
await expect(back).not.toHaveAttribute("href", /.+/);
```

There is no assertion that the button is disabled while saving. If a future refactor drops `disabled={isSaving}` (or wires it to the wrong state), no test fails.

## Goal

A test (e2e or unit) locks in the invariant: while `isSaving=true`, the editor's back/cancel button is disabled and cannot be activated.

## Scope

Pick one of two routes:

- **E2E route**: extend the existing editor-mode test to type into the editor, click Save, and immediately (before the save resolves) assert `await expect(back).toBeDisabled()`. This is the most realistic but is timing-sensitive — slow the save with a Convex test hook or assert before `await page.waitFor*` resolves.
- **Unit route**: add `apps/mirror/features/articles/components/editor/__tests__/article-editor-toolbar.test.tsx` that renders `ArticleEditorToolbar` with `isSaving={true}`, queries for `data-testid="workspace-back-button"`, and asserts `expect(button).toBeDisabled()` and `expect(button).toHaveAttribute("aria-disabled", "true")`. Cheaper, deterministic, and pinned to the prop wiring directly.

## Out of Scope

- Changing the production wiring of `disabled={isSaving}`.
- Refactoring `WorkspaceBackButton`'s prop shape.
- Adding tests for `hasPendingUploads` (Save-only disable path) — that's a separate behavior and ticket if needed.

## Approach

**Recommended: unit route.** It pins the invariant at the component boundary (the `disabled` prop is the contract) and avoids e2e timing issues. The e2e suite already proves the editor renders end-to-end; this ticket adds the missing prop-flow proof.

Sketch:

```tsx
// apps/mirror/features/articles/components/editor/__tests__/article-editor-toolbar.test.tsx
import { render, screen } from "@testing-library/react";
import { ArticleEditorToolbar } from "../article-editor-toolbar";

test("back button is disabled while saving", () => {
  render(
    <ArticleEditorToolbar
      status="draft"
      isSaving={true}
      hasPendingUploads={false}
      onSave={() => {}}
      onPublishToggle={async () => {}}
      onCancel={() => {}}
    />,
  );
  const back = screen.getByTestId("workspace-back-button");
  expect(back).toBeDisabled();
});

test("back button is enabled when not saving", () => {
  // ... isSaving={false}, expect not disabled
});
```

If the unit harness needs WorkspaceToolbar context, mock or wrap it accordingly.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Decide between unit and e2e route. Default: unit.
2. Unit route:
   - Create `apps/mirror/features/articles/components/editor/__tests__/article-editor-toolbar.test.tsx` mirroring the existing editor-area unit test setup (look for `*.test.tsx` siblings under `apps/mirror/features/articles/components/`).
   - Render twice: once with `isSaving=true` (assert disabled), once with `isSaving=false` (assert enabled).
   - Run `pnpm --filter=@feel-good/mirror test:unit` and confirm new tests pass.
3. E2E route (alternative):
   - Extend the existing test at `workspace-back-button.authenticated.spec.ts:75-92`.
   - Type into the editor body, click `getByTestId("save-article-btn")`, then immediately `await expect(back).toBeDisabled()` before any explicit save-success wait.
   - Run `pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button`.
4. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` — both exit 0.

## Constraints

- Do not change `ArticleEditorToolbar` source — this ticket is test-only.
- If unit-testing, use `screen.getByTestId("workspace-back-button")` and `toBeDisabled()` matchers (jest-dom) rather than asserting on internal class names.
- Keep the test file co-located with the component under `__tests__/` per project convention.

## Resources

- Component under test: `apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:18-58`
- E2E spec to potentially extend: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92`
- Sibling unit tests for shape reference: search `apps/mirror/features/articles` for existing `*.test.tsx`
- Related ticket: `FG_161` (Cancel-actually-navigates) — both share the editor-mode coverage gap
