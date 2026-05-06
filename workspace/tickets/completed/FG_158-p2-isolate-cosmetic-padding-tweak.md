---
id: FG_158
title: "Isolate unrelated post-list-item padding tweak from feature PRs"
date: 2026-05-06
type: chore
status: completed
priority: p2
description: "PR #39's title is feat(articles): add Edit button to article detail toolbar, and its second commit is the back-button refactor. The padding change at apps/mirror/features/posts/components/list/post-list-item.tsx:45 (py-12 to py-10) has no logical connection to either commit. A future bisect for a post-list visual regression will land on a refactor commit and waste investigation time. Confirm the value is intentional and codify a process rule to keep cosmetic tweaks out of unrelated feature/refactor PRs."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Visual confirmation that py-10 is intentional and the post-list spacing reads correctly at desktop viewport (Chrome MCP screenshot of /@test-user/posts attached to ticket completion notes), OR the value is reverted to py-12 with a one-line commit"
  - "workspace/lessons.md contains a new bullet (or section) codifying the rule that unrelated cosmetic tweaks must ship in their own commit/PR — verifiable by grep -n 'cosmetic' workspace/lessons.md returning at least one match dated 2026-05"
  - "If the change is reverted: pnpm --filter=@feel-good/mirror build exits 0 and pnpm --filter=@feel-good/mirror lint produces 0 errors"
  - "If the change is kept: no further code change is required, but the lessons.md update is mandatory"
owner_agent: "Process discipline maintainer"
---

# Isolate unrelated post-list-item padding tweak from feature PRs

## Context

The merged PR #39 is titled `feat(articles): add Edit button to article detail toolbar` and contains two logically related commits (the Edit button addition and the back-button unification refactor). It also bundles a one-line cosmetic change at `apps/mirror/features/posts/components/list/post-list-item.tsx:45`:

```diff
-  className="… py-12 …"
+  className="… py-10 …"
```

This padding tweak is not related to either the Edit button or the back-button refactor. The risk is procedural rather than functional:

1. A future bisect investigating a post-list visual regression will land on a "feat(articles)" or "refactor(workspace)" commit and waste investigation time.
2. PR descriptions and release notes drift from reality — readers cannot trust the title to summarize the change set.
3. It normalizes drive-by edits, which compound over time.

The codebase already has a "Always Choose the Compounding Option" core principle (`AGENTS.md` § Core Principles) — that principle applies here: file the lesson upstream so future PRs don't repeat the pattern.

## Goal

Either the cosmetic change is verified intentional (and stays), or it is reverted; in either case, a permanent lesson exists in `workspace/lessons.md` that future agents and reviewers will see when staging multi-purpose PRs.

## Scope

- Visually verify whether `py-10` reads correctly on `/@test-user/posts` at desktop viewport.
- If intentional: keep the value, add the lesson.
- If accidental: revert to `py-12` in a tightly-scoped commit, add the lesson.
- Add a one-line entry to `workspace/lessons.md` codifying the rule: "Unrelated visual/cosmetic tweaks ship in their own commit/PR — never bundled into a feat/refactor."

## Out of Scope

- Auditing other recent PRs for similar bundling.
- Adding lint rules or CI hooks to detect drive-by changes (a separate ticket if desired).
- Refactoring `post-list-item.tsx` beyond the single padding token.
- Adding visual-regression test infrastructure.

## Approach

1. Use Chrome MCP to screenshot `/@test-user/posts` at desktop (1440x960) viewport with the current `py-10`.
2. Compare against the prior `py-12` (`git stash` is not necessary — read the diff and reason about the spacing delta visually if confidence is high).
3. Decision:
   - If `py-10` reads correctly and the developer's intent is plausible (e.g., tightening list density), keep it.
   - If `py-10` looks too tight or breaks rhythm with adjacent components, revert to `py-12` in a single-file commit titled `chore(posts): restore py-12 list-item padding accidentally changed in PR #39`.
4. Add the lessons.md entry in either case.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Open the post list page in a dev environment (`pnpm dev --filter=@feel-good/mirror`) and navigate to `/@test-user/posts`.
2. Screenshot the post list via Chrome MCP and assess spacing against the article list and other workspace surfaces.
3. If keeping `py-10`: no source-code change. Skip to step 5.
4. If reverting: edit `apps/mirror/features/posts/components/list/post-list-item.tsx:45` and change `py-10` back to `py-12`. Run `pnpm --filter=@feel-good/mirror build && pnpm --filter=@feel-good/mirror lint`.
5. Append a bullet to `workspace/lessons.md` under a "PR hygiene" or equivalent section, matching the existing prose style:
   - Example wording: "(2026-05) Cosmetic/visual tweaks (e.g., a `py-12 → py-10` swap) must ship in their own commit and PR. Bundling them into a feat/refactor PR pollutes the bisect history and breaks the trust that PR titles summarize the change set."
6. Commit lessons.md and (if applicable) the revert as separate commits with explicit subjects.

## Constraints

- Do not bundle the lessons.md update with the revert into a single commit — they are independent outcomes.
- No additional refactors of `post-list-item.tsx`.
- Do not retroactively rewrite history of merged PR #39.

## Resources

- File anchor: `apps/mirror/features/posts/components/list/post-list-item.tsx:45`
- Originating PR: `#39 feature-edit-article-button`
- Project core principle: `AGENTS.md` § Core Principles — "Always Choose the Compounding Option"
- Lessons file: `workspace/lessons.md`
