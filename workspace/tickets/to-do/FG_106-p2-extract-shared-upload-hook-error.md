---
id: FG_106
title: "Inline-image upload validation error and hook scaffolding extracted to shared module"
date: 2026-05-02
type: refactor
status: to-do
priority: p2
description: "use-article-inline-image-upload and use-post-inline-image-upload define identical InlineImageValidationError classes and identical MIME/size validation logic. Catch sites that want to handle errors via instanceof must import from the correct namespace, and any change to the error shape or validation rules requires a two-place edit. Extract the error class and validation helper to a shared module under apps/mirror/lib/."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "InlineImageValidationError is defined in exactly ONE location — likely apps/mirror/lib/inline-image-validation.ts (or features/content/lib/) — not in either feature hook"
  - "Both use-article-inline-image-upload.ts and use-post-inline-image-upload.ts import the class from the shared location"
  - "validateInlineImageFile (or equivalent) exists once and is imported by both hooks"
  - "An instanceof InlineImageValidationError check works identically across articles and posts upload paths"
  - "Existing use-article-inline-image-upload.test.ts continues to pass"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Mirror app refactor specialist"
---

# Inline-image upload validation error and hook scaffolding extracted to shared module

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #20, maintainability + kieran-typescript at confidence 0.90.

`apps/mirror/features/articles/hooks/use-article-inline-image-upload.ts:20-27` and `apps/mirror/features/posts/hooks/use-post-inline-image-upload.ts:20-27` each define:

```ts
export class InlineImageValidationError extends Error {
  readonly code: "mime-not-allowed" | "size-exceeded";
  constructor(code: ..., message: string) {
    super(message);
    this.name = "InlineImageValidationError";
    this.code = code;
  }
}
```

Identical body. Two distinct classes at runtime. A consumer that catches via `if (err instanceof InlineImageValidationError)` works only with the version it imported — the other surface is a different class, so cross-feature error handling is broken.

The MIME / size validation logic surrounding the throw is also duplicated. Any future addition (e.g., support for `image/avif`) must be applied twice.

`apps/mirror/lib/media-policy.ts` already exists as the shared client-side policy module (re-exporting from `storage-policy.ts`). The validation helper and error class belong next to it.

## Scope

- New file: `apps/mirror/lib/inline-image-validation.ts` exporting `InlineImageValidationError` class + `validateInlineImageFile(file: File): void` (throws on mismatch).
- `use-article-inline-image-upload.ts` and `use-post-inline-image-upload.ts` — import from the shared module, remove local class + helper.
- Update `__tests__/use-article-inline-image-upload.test.ts` imports.
- Posts-side test file (FG_108 territory) imports from the shared module if/when it's created.

## Goal

After this ticket, `InlineImageValidationError` is one class. Cross-surface `instanceof` checks work. Adding a new MIME type to the allowlist is a one-place edit.

## Out of Scope

- Refactoring the upload hooks themselves (their query/mutation wiring is entity-specific and stays in each feature module).
- Sharing the entire upload-hook body — those are intentionally per-namespace because they reference `api.{articles,posts}.inlineImages.*`.

## Approach

```ts
// apps/mirror/lib/inline-image-validation.ts
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_INLINE_IMAGE_BYTES,
} from "./media-policy";

export class InlineImageValidationError extends Error {
  readonly code: "mime-not-allowed" | "size-exceeded";
  constructor(code: InlineImageValidationError["code"], message: string) {
    super(message);
    this.name = "InlineImageValidationError";
    this.code = code;
  }
}

export function validateInlineImageFile(file: File): void {
  if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
    throw new InlineImageValidationError(
      "mime-not-allowed",
      `Unsupported image type: ${file.type || "(unknown)"}`,
    );
  }
  if (file.size > MAX_INLINE_IMAGE_BYTES) {
    throw new InlineImageValidationError(
      "size-exceeded",
      `Image too large: ${file.size} bytes exceeds ${MAX_INLINE_IMAGE_BYTES}`,
    );
  }
}
```

Both hooks call `validateInlineImageFile(file)` early in their upload function and import the error class from the same file.

- **Effort:** Small
- **Risk:** Low — pure extraction; runtime behavior identical.

## Implementation Steps

1. Create `apps/mirror/lib/inline-image-validation.ts` with the shared class and helper.
2. In `apps/mirror/features/articles/hooks/use-article-inline-image-upload.ts`: remove the local class + validation block; import + call the shared helper.
3. Same for `apps/mirror/features/posts/hooks/use-post-inline-image-upload.ts`.
4. Update `apps/mirror/features/articles/__tests__/use-article-inline-image-upload.test.ts` import path.
5. Run `pnpm --filter=@feel-good/mirror build` and any existing tests.

## Constraints

- Error class name and `code` field values must remain stable — production code may already discriminate on them.
- The shared module must be client-side-safe (no Convex runtime imports, no Node imports).

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #20.
- `apps/mirror/lib/media-policy.ts` — neighbor module.
- `apps/mirror/features/articles/hooks/use-article-inline-image-upload.ts:20-50` — current site.
