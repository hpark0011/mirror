---
id: FG_161
title: "Editor Cancel button actually navigates back to article detail"
date: 2026-05-06
type: improvement
status: to-do
priority: p2
description: "The existing editor-mode e2e test at apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92 asserts role/aria-label/href-absence but never clicks the Cancel button or verifies the resulting URL. The onCancel prop chain through ArticleEditorShell -> ArticleEditorToolbar -> WorkspaceBackButton could break (handler dropped, swallowed, or wired to the wrong target) without test failure. Add coverage that clicks Cancel and asserts the post-click URL resolves to the article detail (not /edit)."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "A new test in apps/mirror/e2e/workspace-back-button.authenticated.spec.ts (or extension of the existing editor test) clicks the workspace-back-button in editor mode and asserts page.url() resolves to /@test-user/articles/<draftSlug> (no /edit suffix)"
  - "grep -nE \"click\\(\\)|toHaveURL|page\\.url\\(\\)\" apps/mirror/e2e/workspace-back-button.authenticated.spec.ts shows the new click + URL assertion"
  - "The new test passes against the current build"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "Playwright e2e author"
---

# Editor Cancel button actually navigates back to article detail

## Context

The article editor's back button is rendered via:

```
ArticleEditorShell
  └── ArticleEditorToolbar (passes onCancel)
        └── WorkspaceBackButton (calls onCancel onClick)
```

The `onCancel` prop chain is not currently tested for behavior — only for rendering. The existing test at `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92`:

```ts
const back = page.getByTestId("workspace-back-button");
await expect(back).toBeVisible({ timeout: 10_000 });
await expect(back).toHaveRole("button");
await expect(back).toHaveAccessibleName("Cancel");
await expect(back).not.toHaveAttribute("href", /.+/);
```

It never clicks the button. A regression that drops `onCancel` (e.g., `ArticleEditorShell` no longer passes it, or `ArticleEditorToolbar` swallows the prop, or `WorkspaceBackButton`'s `onClick={props.onClick}` is mistyped) would silently break the cancel navigation without any test failure.

This complements FG_160 (disabled-while-saving) — together they cover the editor-mode back-button contract.

## Goal

A test clicks the editor's back button and confirms the user lands on the article detail URL (`/@test-user/articles/<draftSlug>` — no `/edit` suffix).

## Scope

- Add a new test (or extend the existing editor-mode test) to:
  1. Navigate to `/@test-user/articles/<draftSlug>/edit`.
  2. Click `getByTestId("workspace-back-button")`.
  3. Assert `await expect(page).toHaveURL(new RegExp(\`/@test-user/articles/${draftSlug}(?!/edit)\`))` or equivalent.

## Out of Scope

- Asserting on the article detail content rendering correctly (covered by other detail-page tests).
- Testing the publish-toggle or save flows.
- Testing Cancel behavior when `onCancel` is undefined (not currently a supported state).
- Adding tests for the back button in non-editor contexts (already covered).

## Approach

Append a new test inside the existing `test.describe("Workspace back button — unified component", ...)` block:

```ts
test("article editor cancel navigates back to article detail", async ({
  authenticatedPage: page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const { draftSlug } = await ensureTestArticleFixtures();

  await page.goto(`/@${username}/articles/${draftSlug}/edit`, {
    waitUntil: "domcontentloaded",
  });
  await waitForAuthReady(page);

  const back = page.getByTestId("workspace-back-button");
  await expect(back).toBeVisible({ timeout: 10_000 });
  await back.click();

  // Assert we left /edit and landed on the article detail URL.
  await expect(page).toHaveURL(
    new RegExp(`/@${username}/articles/${draftSlug}(?:\\?|$|#)`),
  );
});
```

The negative-lookahead pattern in the URL regex ensures `/edit` is NOT in the post-click URL.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Read `apps/mirror/features/articles/components/editor/article-editor-shell.tsx` (or the corresponding file in the feature module) to confirm what `onCancel` does — typically a `router.push` or `router.back` to the detail URL.
2. Append the new test to `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts` after the existing editor-mode test.
3. Use `await expect(page).toHaveURL(regex)` rather than `expect(page.url()).toMatch(...)` so Playwright's autowait kicks in.
4. Run `pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button` and confirm green.
5. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` — both exit 0.

## Constraints

- Do not modify `ArticleEditorShell`, `ArticleEditorToolbar`, or `WorkspaceBackButton` — this is test-only.
- Use the draft fixture (`draftSlug`) so that any "save before navigation" prompt does not interfere; if such a prompt is shown for unsaved-but-untouched drafts, dismiss it explicitly.
- Stay within the existing `test.describe(...)` block.

## Resources

- Spec to extend: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts`
- Editor shell wiring: `apps/mirror/features/articles/components/editor/` (look for `article-editor-shell.tsx` and `article-editor-toolbar.tsx`)
- Related tickets: `FG_160` (disabled-while-saving), `FG_159` (chat-aware href preservation)
