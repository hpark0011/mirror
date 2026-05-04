---
id: FG_137
title: "Remove the dead backwards-compat slug prop from ArticleEditor"
date: 2026-05-05
type: refactor
status: to-do
priority: p2
description: "ArticleEditor declares slug? as backwards-compat but never reads it; the only caller still passes it. AGENTS.md prohibits backwards-compat shims for hypothetical needs."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'slug?' apps/mirror/features/articles/components/article-editor.tsx` returns no matches."
  - "`grep -n 'slug=' apps/mirror/app/[username]/@content/articles/[slug]/edit/page.tsx` returns no matches passing slug to <ArticleEditor>."
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` pass."
owner_agent: "frontend engineer (React)"
---

# Remove the dead backwards-compat slug prop from ArticleEditor

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch). `apps/mirror/features/articles/components/article-editor.tsx:13-15` declares:

```ts
// `slug` arg kept for backwards-compat with the existing edit page;
// the form hook reads slug off `article.slug`.
slug?: string;
```

The component destructures only `{ article, username }` and never reads `slug`. The only caller (`apps/mirror/app/[username]/@content/articles/[slug]/edit/page.tsx`) still passes `slug={slug}`. The "backwards-compat" comment points to a hypothetical caller that doesn't exist — the call site is owned by this same repo, in the same diff, and the prop was just changed from required to optional.

`AGENTS.md` core principle: "No backwards-compat shims for hypothetical needs." Per `.claude/rules/dev-process.md`: dead surfaces and misleading comments increase the cognitive load of future refactors.

**Risk:** dead prop in the public surface; readers see the comment and assume slug-override behavior is active when it isn't.

## Goal

`ArticleEditor` no longer accepts a `slug` prop; the caller no longer passes it.

## Scope

- Remove `slug?: string` from `ArticleEditorProps`.
- Remove the misleading comment.
- Remove `slug={slug}` from the call site.

## Out of Scope

- Changing how the form hook reads slug (still off `article.slug`).
- Wider refactor of `ArticleEditor`.

## Approach

Two-file mechanical change.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/features/articles/components/article-editor.tsx`, remove the comment and the `slug?: string;` line from `ArticleEditorProps` (lines 13-15).
2. In `apps/mirror/app/[username]/@content/articles/[slug]/edit/page.tsx`, remove the `slug={slug}` attribute from the `<ArticleEditor>` element (line 44 or thereabouts).
3. Verify nothing else passes `slug` to `ArticleEditor`: `grep -rn 'ArticleEditor' apps/mirror/`.
4. Run `pnpm build --filter=@feel-good/mirror`.

## Constraints

- Deletion-only change. Do not add new abstractions.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- `AGENTS.md` core principles
