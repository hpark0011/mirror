---
id: FG_157
title: "WorkspaceBackButton accessible name matches its visible label"
date: 2026-05-06
type: fix
status: to-do
priority: p1
description: "In editor (action) mode the WorkspaceBackButton renders hardcoded visible text 'Back' while ariaLabel='Cancel' is passed from ArticleEditorToolbar. The aria-label overrides the accessible name, so screen readers announce 'Cancel' while sighted users see 'Back'. This violates WCAG 2.5.3 Label in Name: voice-control users saying 'click Back' cannot activate the editor's Cancel button. The existing e2e spec currently codifies this mismatch as expected and must change."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "In apps/mirror/features/content/components/workspace-back-button.tsx, the action-mode render path (the second branch of WorkspaceBackButtonProps) produces a visible label that contains the aria-label string verbatim (or drops the aria-label override entirely so the visible text 'Back' is also the accessible name)"
  - "grep -n 'Back' apps/mirror/features/content/components/workspace-back-button.tsx | wc -l matches the post-fix expectation (either both branches still render 'Back' with no ariaLabel override, or action mode renders the ariaLabel string as visible text)"
  - "apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:89 no longer asserts toHaveAccessibleName('Cancel') on the action-mode case while the visible text is 'Back' — the spec is updated to match the new contract"
  - "pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button passes"
  - "pnpm --filter=@feel-good/mirror build exits 0"
  - "pnpm --filter=@feel-good/mirror lint produces 0 errors"
owner_agent: "Accessibility-aware React component fixer"
---

# WorkspaceBackButton accessible name matches its visible label

## Context

`WorkspaceBackButton` (`apps/mirror/features/content/components/workspace-back-button.tsx:28-42`) hardcodes the visible text "Back" in both branches:

```tsx
return (
  <Button
    type="button"
    variant="wrapper"
    size="wrapper-xs"
    onClick={props.onClick}
    disabled={props.disabled}
    aria-label={props.ariaLabel}              // <- "Cancel" passed from editor
    className="gap-1.5 relative left-[-1px]"
    data-testid="workspace-back-button"
  >
    <ArrowshapeLeftFillIcon className="size-4.5 transition-all duration-100" />
    Back                                       // <- visible text remains "Back"
  </Button>
);
```

Meanwhile `ArticleEditorToolbar` (`apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:29-35`) passes `ariaLabel="Cancel"`. Because `aria-label` always wins over child text content for the accessible name computation, screen readers announce "Cancel" while sighted users see "Back".

This violates [WCAG 2.5.3 Label in Name](https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html): the accessible name MUST contain the visible text. Concrete failure modes:

- Voice-control users (Dragon, Voice Control on macOS, Windows Speech Recognition) saying "click Back" cannot activate the button — the assistive tech matches against the accessible name "Cancel".
- The existing e2e spec at `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92` currently asserts `toHaveAccessibleName("Cancel")` while the rendered text is "Back" — it codifies the bug as the expected behavior.

The bug was introduced as part of the PR #39 back-button unification refactor.

## Goal

The action-mode render of `WorkspaceBackButton` produces an accessible name equal to (or containing) its visible text, satisfying WCAG 2.5.3. Voice-control users saying the visible label can activate the button.

## Scope

- Pick one of the two fixes:
  1. **Drop the `ariaLabel` override** in the action-mode branch and let the visible "Back" text become the accessible name. Remove `ariaLabel="Cancel"` from `apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:33`. Treat the editor's back button as semantically "Back" (the user is going back to the article detail). Simpler — recommended unless the product copy explicitly requires "Cancel".
  2. **Reflect `ariaLabel` in the visible text** when in action mode (e.g., render `props.ariaLabel ?? "Back"` as the child text). Keeps the editor's "Cancel" semantics but the visible label updates accordingly.
- Update `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92` to match the chosen fix:
  - For fix (1): assert `toHaveAccessibleName("Back")` and remove the `aria-label` assertion mismatch.
  - For fix (2): assert visible text matches `aria-label` ("Cancel" in this case).

## Out of Scope

- Changing the icon, role, or `data-testid`.
- Restructuring the discriminated-union props of `WorkspaceBackButton`.
- Touching link-mode behavior — the link branch already has matching visible/accessible "Back".
- Any change to the post-detail editor or other consumers (not in PR #39 scope; the unified component has only two known action-mode call sites).

## Approach

Recommended: **Fix (1) — drop the override.**

Reasoning: the icon plus "Back" text is already understood as a navigation-back affordance. Calling it "Cancel" is a semantic micro-distinction that is not worth a WCAG violation. The editor cancel flow is "navigate back to the read view" — "Back" describes that accurately.

If product insists on "Cancel" for the editor, take Fix (2) and have the action-mode branch render `{props.ariaLabel ?? "Back"}` as visible text (or drop `ariaLabel` in favor of an optional `label` prop that drives both the visible text and the accessible name).

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Decide between Fix (1) and Fix (2). Default: Fix (1).
2. For Fix (1):
   - Edit `apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:33` — remove `ariaLabel="Cancel"`.
   - Optionally remove `ariaLabel` from `WorkspaceBackButtonProps` action-mode union if no other consumer uses it (`grep -rn 'ariaLabel=' apps/mirror | grep -i back` — verify single call site).
3. For Fix (2):
   - Edit `apps/mirror/features/content/components/workspace-back-button.tsx` action-mode branch to render `{props.ariaLabel ?? "Back"}` as the visible text instead of the hardcoded "Back".
4. Update `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92` so its assertions match the new contract.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- workspace-back-button` and confirm green.
6. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint` and confirm both exit 0.
7. Manual screen-reader spot-check (VoiceOver or NVDA): focus the editor's back button, confirm the announced name matches the visible text.

## Constraints

- Do not introduce a new prop API just to thread "Cancel" semantics — prefer Fix (1).
- The fix must be applied to the unified `WorkspaceBackButton`, not by re-introducing a per-call-site override.
- Keep the link-mode branch unchanged — it already complies.
- Do not relax the e2e assertion to a generic "either Back or Cancel" — pick one and lock it in.

## Resources

- File under fix: `apps/mirror/features/content/components/workspace-back-button.tsx:28-42`
- Caller passing the override: `apps/mirror/features/articles/components/editor/article-editor-toolbar.tsx:29-35`
- Test that codifies the mismatch: `apps/mirror/e2e/workspace-back-button.authenticated.spec.ts:75-92`
- WCAG SC: https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html
- Originating PR: `#39 feature-edit-article-button` — second commit, back-button unification (`71e35950 refactor(workspace): unify back button across detail and editor toolbars`)
