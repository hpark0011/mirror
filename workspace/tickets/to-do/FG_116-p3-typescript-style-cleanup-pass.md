---
id: FG_116
title: "TypeScript style cleanup pass on inline-image lifecycle code"
date: 2026-05-02
type: chore
status: to-do
priority: p3
description: "ce:review surfaced a batch of low-severity TypeScript style and shape findings across the inline-image lifecycle code: separate import-type statements that should be inline (project rule), authUser._id as string casts that erase the BetterAuth brand without comment, createInlineImageExtension return type widened to bare Node, two markdown-upload-dialog files at 130 and 145 lines (>100 guideline), apps/mirror/lib/media-policy.ts adding only one derived constant on top of storage-policy.ts, and missing typesVersions parity for packages/features's new editor export. Apply as a single style cleanup pass so each individual nit doesn't become its own PR."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -nE '^import type \\{' packages/convex/convex/articles/actions.ts packages/convex/convex/posts/actions.ts packages/convex/convex/content/body-walk.ts packages/convex/convex/crons.ts apps/mirror/features/articles/hooks/use-article-inline-image-upload.ts apps/mirror/features/posts/hooks/use-post-inline-image-upload.ts apps/mirror/features/articles/components/article-editor.tsx apps/mirror/features/posts/components/post-editor.tsx packages/features/editor/lib/sanitize-content.ts apps/mirror/app/\\[username\\]/@content/articles/\\[slug\\]/edit/page.tsx apps/mirror/app/\\[username\\]/@content/posts/\\[slug\\]/edit/page.tsx returns 0 matches (all separate `import type` statements converted to inline `import { type ... }` form)"
  - "createInlineImageExtension's return type annotation in packages/features/editor/lib/inline-image-extension.ts is either inferred or correctly typed (not bare Node)"
  - "markdown-upload-dialog.tsx and markdown-upload-dialog-connector.tsx are each <110 lines (component-size guideline)"
  - "packages/features/package.json includes a typesVersions entry for ./editor/components/rich-text-editor (parity with the exports map)"
  - "pnpm --filter=@feel-good/mirror build passes — no TS errors introduced"
  - "Existing tests still pass: pnpm --filter=@feel-good/convex test && pnpm --filter=@feel-good/features test"
owner_agent: "TypeScript / refactor specialist"
---

# TypeScript style cleanup pass on inline-image lifecycle code

## Context

ce:review (`feature-add-editor`, 2026-05-02) Findings #40, #41, #42, #43, plus parts of #24 (kieran-typescript) and #25 (api-contract null-src sentinel). Grouped into one chore-level cleanup pass to avoid 6+ tiny PRs. Each item is independent and small.

**Items:**

1. **Separate `import type` statements (project-standards #40, conf 0.92)** — `.claude/rules/typescript.md` requires inline form (`import { type Id }` not `import type { Id }`). At least 10 new files violate this:
   - `packages/convex/convex/content/body-walk.ts:21`
   - `packages/convex/convex/articles/actions.ts:30`
   - `packages/convex/convex/posts/actions.ts:30`
   - `packages/convex/convex/crons.ts:15`
   - `apps/mirror/features/articles/hooks/use-article-inline-image-upload.ts:6`
   - `apps/mirror/features/posts/hooks/use-post-inline-image-upload.ts:6`
   - `apps/mirror/app/[username]/@content/articles/[slug]/edit/page.tsx:3`
   - `apps/mirror/app/[username]/@content/posts/[slug]/edit/page.tsx:3`
   - `apps/mirror/features/articles/components/article-editor.tsx:23`
   - `apps/mirror/features/posts/components/post-editor.tsx:21`
   - `packages/features/editor/lib/sanitize-content.ts:1`

2. **Component size guideline (project-standards #41, conf 0.71)** — `markdown-upload-dialog.tsx` (145 lines) and `markdown-upload-dialog-connector.tsx` (130 lines) exceed `~100`. Extract the import-result display section into its own component or a `useImportResultStatus` hook.

3. **createInlineImageExtension return type (kieran-typescript #42, conf 0.65)** — `packages/features/editor/lib/inline-image-extension.ts:15` declares the return type as bare `Node` from `@tiptap/core`. Inferred type is more accurate.

4. **typesVersions parity for new editor export (api-contract #43, conf 0.62)** — `packages/features/package.json` adds `./editor/components/rich-text-editor` to `exports` but no parallel `typesVersions` entry. Existing `@feel-good/features` package may rely on `exports`-only resolution; verify by trying to import `RichTextEditor` from a strict `node16`/`bundler` consumer and check whether typings resolve.

## Goal

After this ticket, the inline-image lifecycle code conforms to the project's TypeScript style rules. Future review of this code does not surface the same nits.

## Scope

- All ten or more `import type` violations migrated to inline form.
- `markdown-upload-dialog{,connector}.tsx` decomposed below the 100-line ceiling.
- `createInlineImageExtension` return type fixed.
- `packages/features/package.json` typesVersions entry added.

## Out of Scope

- Refactoring the import flow itself (FG_095, FG_101, FG_112 territory).
- Other components in the codebase exceeding 100 lines (only the two introduced by this PR).
- The `bytes as unknown as ArrayBuffer` cast — already addressed in FG_022 (applied).

## Approach

Each item is mechanical:

1. **Inline `import type`:** find/replace `import type { X } from "..."` → `import { type X } from "..."`. Where multiple types are imported alongside values, merge: `import { foo, type Bar } from "..."`.

2. **Dialog decomposition:** look at `markdown-upload-dialog.tsx:106-122` (the import-result display) and `markdown-upload-dialog-connector.tsx`'s cover-image state block. Extract each into a small named component or hook.

3. **Extension return type:** drop the explicit `: Node` annotation and let TS infer, or replace with `: Extensions[number]`.

4. **typesVersions:** add `"editor/components/rich-text-editor": ["./editor/components/rich-text-editor.tsx"]` to `packages/features/package.json`'s `typesVersions["*"]` block. Verify the path is correct vs. how other entries are declared.

- **Effort:** Small (each item)
- **Risk:** Low — pure style; no runtime behavior changes.

## Implementation Steps

1. Search for all `^import type \{` occurrences in the inline-image-affected files and convert to inline form.
2. Extract import-result display from `markdown-upload-dialog.tsx` into a sub-component.
3. Extract cover-image state block from `markdown-upload-dialog-connector.tsx` into a `useCoverImageState` hook.
4. Drop the `: Node` annotation in `inline-image-extension.ts` (or replace with proper inferred type).
5. Add `typesVersions` entry to `packages/features/package.json`.
6. Run `pnpm --filter=@feel-good/mirror build` to confirm no TS regressions.
7. Run `pnpm --filter=@feel-good/convex test` and `pnpm --filter=@feel-good/features test`.

## Constraints

- No runtime behavior changes — pure style/type cleanup.
- Component decomposition must keep all existing tests green.
- typesVersions entry must match the exports-map path exactly.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Findings #40, #41, #42, #43.
- `.claude/rules/typescript.md` — inline-type-import rule.
- `.claude/rules/react-components.md` — ~100-line guideline.
- `.claude/rules/identifiers.md` — `typesVersions` parity rule for shared packages.
