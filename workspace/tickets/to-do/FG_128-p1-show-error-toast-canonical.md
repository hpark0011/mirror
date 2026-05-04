---
id: FG_128
title: "Article forms use the canonical showToast helper for error toasts"
date: 2026-05-05
type: refactor
status: to-do
priority: p1
description: "Both article form hooks duplicate an 18-line toast.custom JSX block while the rest of the app uses a single-line showToast helper."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'toast.custom' apps/mirror/features/articles/hooks/` returns no matches in `use-new-article-form.tsx` or `use-edit-article-form.tsx`."
  - "Both hooks call `showToast({ type: 'error', title: getMutationErrorMessage(err) })` from `@feel-good/ui/components/toast` in the catch branches."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
  - "Manually triggering a save failure (e.g. duplicate slug) still surfaces a visible error toast in the dev app."
owner_agent: "frontend engineer (React)"
---

# Article forms use the canonical showToast helper for error toasts

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `apps/mirror/features/articles/hooks/use-new-article-form.tsx:58-76` and `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:66-84` each define a `showErrorToast` callback that renders an identical 18-line `<Toast><ToastIcon className="text-red-9"><OctagonXIcon /></ToastIcon><ToastHeader><ToastTitle>{message}</ToastTitle></ToastHeader><ToastClose /></Toast>` tree. The rest of the app — `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:74` and the posts hooks — uses the canonical one-liner `showToast({ type: 'error', title: getMutationErrorMessage(err) })` from `@feel-good/ui/components/toast`.

**Risk:** any future change to error-toast styling, icon, role, or duration must be applied in two places, and the divergence will silently grow.

## Goal

Article form error toasts use the same canonical helper as every other feature in the app.

## Scope

- Replace the inline `showErrorToast` callback in both hooks with `showToast({ type: 'error', title: getMutationErrorMessage(err) })`.
- Remove the now-unused imports of `Toast`, `ToastClose`, `ToastHeader`, `ToastIcon`, `ToastTitle`, `OctagonXIcon`, and `toast` from `sonner` in those hooks.

## Out of Scope

- Refactoring `showToast` itself.
- Changing other features' toast usage.

## Approach

Drop the local helper and use the canonical pattern. `getMutationErrorMessage` already handles the `string | Error | unknown` normalization that `showErrorToast` was duplicating.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `use-new-article-form.tsx`, remove the `showErrorToast` `useCallback` block (lines 58-76); replace its call sites in `save` and `togglePublish` with `showToast({ type: 'error', title: getMutationErrorMessage(err) })`.
2. Add `import { showToast } from "@feel-good/ui/components/toast"` and `import { getMutationErrorMessage } from "<canonical path>"` (locate via `grep -rn "getMutationErrorMessage" apps/mirror/features`).
3. Remove unused imports: `Toast`, `ToastClose`, `ToastHeader`, `ToastIcon`, `ToastTitle`, `OctagonXIcon`, `toast` from sonner.
4. Repeat steps 1-3 for `use-edit-article-form.tsx`.
5. Manually trigger a save failure in dev and confirm the toast renders.

## Constraints

- Toast visual must match the existing app pattern (red error icon, accessible role) — `showToast({ type: 'error', ... })` already provides this.

## Resources

- Canonical pattern reference: `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:74`
- PR #34: https://github.com/hpark0011/mirror/pull/34
