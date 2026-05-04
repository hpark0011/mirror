---
id: FG_138
title: "Image insert error messages handle non-Error rejections without showing 'undefined'"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "Two editor error paths cast caught values to Error and read .message, producing 'Failed to insert image: undefined' for string or non-Error rejections."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n '(error as Error).message' packages/features/editor/components/editor-toolbar.tsx packages/features/editor/extensions/slash-command.ts` returns no matches."
  - "Both paths use `error instanceof Error ? error.message : String(error)` (or equivalent helper)."
  - "A unit test for both paths verifies that a string rejection (`throw 'Upload quota exceeded'`) produces a toast containing the literal text, not 'undefined'."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
owner_agent: "frontend engineer (React)"
---

# Image insert error messages handle non-Error rejections without showing 'undefined'

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086753). Two paths use the unsafe pattern `(error as Error).message`:

- `packages/features/editor/components/editor-toolbar.tsx:44`: `onError?.(\`Failed to insert image: ${(error as Error).message}\`);`
- `packages/features/editor/extensions/slash-command.ts:199`: same pattern inside the IIFE catch block.

If the upload pipeline rejects with a string (`throw 'Quota exceeded'`), a `ConvexError` object whose `.message` may be a nested key, or any non-Error rejection, `.message` is `undefined`. The user sees a toast with the literal text "Failed to insert image: undefined" — meaningless, no recovery info.

The form hooks already use the safe pattern in `showErrorToast`:
```ts
typeof err === 'string' ? err : err instanceof Error ? err.message : 'Something went wrong'
```

**Risk:** unactionable error message; users retry repeatedly with no idea what failed.

## Goal

Image-insert errors always produce a meaningful toast message, regardless of the rejection shape.

## Scope

- Replace both `(error as Error).message` casts with the safe extractor.

## Out of Scope

- Changing the upload pipeline's error shape.
- Wider error-handling refactor.

## Approach

Reuse the canonical `getMutationErrorMessage` helper if available, or inline the safe pattern.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `packages/features/editor/components/editor-toolbar.tsx:44`, replace `(error as Error).message` with `error instanceof Error ? error.message : String(error)`.
2. Repeat in `packages/features/editor/extensions/slash-command.ts:199`.
3. Add a Vitest test that throws a plain string from the mocked uploader and asserts the resulting `onError` argument contains the string, not `undefined`.

## Constraints

- Do not change the `onError` callback signature.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086753
