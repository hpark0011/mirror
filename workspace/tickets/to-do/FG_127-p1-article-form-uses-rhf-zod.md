---
id: FG_127
title: "Article metadata form is wired through React Hook Form and zodResolver"
date: 2026-05-05
type: refactor
status: to-do
priority: p1
description: "Both article form hooks manage state via per-field useState and validate imperatively, while the existing Zod schema sits unused — violating the project forms rule."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`use-new-article-form.tsx` and `use-edit-article-form.tsx` both import `articleMetadataSchema` and use `useForm({ resolver: zodResolver(articleMetadataSchema) })`."
  - "`grep -n 'useState' apps/mirror/features/articles/hooks/use-new-article-form.tsx` shows no per-field useState for title/slug/category/status (transient flags like isSaving may remain)."
  - "`grep -n 'throw new Error.*required' apps/mirror/features/articles/hooks/` returns no imperative validation guards in the persist callbacks."
  - "`pnpm build --filter=@feel-good/mirror`, `pnpm lint --filter=@feel-good/mirror`, and the existing form tests all pass."
owner_agent: "frontend engineer (RHF)"
---

# Article metadata form is wired through React Hook Form and zodResolver

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `apps/mirror/features/articles/lib/schemas/article-metadata.schema.ts` defines `articleMetadataSchema` (Zod) and exports `ArticleMetadataFormData`. Neither `apps/mirror/features/articles/hooks/use-new-article-form.tsx` nor `apps/mirror/features/articles/hooks/use-edit-article-form.tsx` imports it. Both manage every metadata field via individual `useState` calls (lines 47-56 of the new form, 45-65 of the edit form) and run imperative validation inside `persist()` (e.g. `if (!title.trim()) throw new Error("Title is required")` at use-new-article-form.tsx:96-100).

This violates `.claude/rules/forms.md` (RHF + Zod + zodResolver via `@feel-good/ui/primitives/form`) and creates a three-way validation contract: server validators + imperative `persist` checks + an unused Zod schema. Future field additions or rule changes will silently diverge across these surfaces.

## Goal

Form state and validation are centralized through RHF + zodResolver; `articleMetadataSchema` is the single client-side source of truth.

## Scope

- Wire `useForm<ArticleMetadataFormData>({ resolver: zodResolver(articleMetadataSchema), defaultValues: ... })` in both hooks.
- Replace per-field `useState`/setter pairs with RHF `register`/`watch`/`setValue` (or `Controller` for the cover-image picker).
- Move imperative `if (!title.trim())` checks out of `persist`; rely on `handleSubmit` blocking submission on validation failure.
- Update `ArticleMetadataHeader` props to accept RHF `register` outputs (or wrap in `Controller`).

## Out of Scope

- Schema rule changes (length limits, allowed characters) — keep current validation surface.
- Touching the cover-image picker beyond plumbing through Controller.
- Changes to the body editor (Tiptap) state, which sensibly stays in `useState`.

## Approach

Adopt the canonical pattern used by `bio` and `posts` forms. The Zod schema already defines `title`, `slug`, `category`, `status`; extend it if needed for `body` (Tiptap JSONContent is hard to express in Zod — accept `z.any()` there or leave body managed by `useState` and only RHF-ify the structured metadata).

- **Effort:** Medium
- **Risk:** Medium (touches both forms, plus the shared metadata-header component)

## Implementation Steps

1. In both `use-new-article-form.tsx` and `use-edit-article-form.tsx`, replace per-field `useState` with `const form = useForm<ArticleMetadataFormData>({ resolver: zodResolver(articleMetadataSchema), defaultValues: ... })`.
2. In `persist`, remove imperative `if (!title.trim()) throw` guards; rely on the RHF `handleSubmit` wrapper to block submission when validation fails.
3. Replace direct prop passing in `article-editor-shell.tsx` so `ArticleMetadataHeader` receives RHF `register` outputs (or refactor it to take the `form` instance via a `Controller` wrapper).
4. Re-run the existing tests under `apps/mirror/features/articles/hooks/__tests__/use-new-article-form.test.ts` and `apps/mirror/features/articles/components/__tests__/article-metadata-header.test.tsx`; update the test surface to drive RHF instead of direct setters.
5. Add a test that submits an empty title and asserts the form's error state shows the schema's `title` message.

## Constraints

- Must not change the server-side mutation arg validators.
- Must not regress the deferred-create invariant covered by FG_141 (mutation must still not fire until Save).

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- `.claude/rules/forms.md`
- Existing pattern: `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts`
