---
id: FG_135
title: "E2E article-editor tests use unique slugs to avoid cross-run collisions"
date: 2026-05-05
type: fix
status: to-do
priority: p2
description: "Four create-path tests use hardcoded titles that derive to deterministic slugs; on persistent test backends the second run collides on the slug and produces non-actionable timeouts."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "`grep -n 'Brand new piece\\|Article with cover\\|Publish me\\|With inline image' apps/mirror/e2e/article-editor.authenticated.spec.ts` shows each title suffixed with `${Date.now()}` (or a uuid)."
  - "URL-shape assertions in those four tests match the slug-with-suffix pattern via regex, not exact string equality."
  - "Running the e2e suite twice in succession against the same backend passes both runs without slug-conflict failures."
  - "`pnpm --filter=@feel-good/mirror test:e2e` passes."
owner_agent: "test engineer (Playwright)"
---

# E2E article-editor tests use unique slugs to avoid cross-run collisions

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch); also raised by CodeRabbit (PR thread r3180086669). `apps/mirror/e2e/article-editor.authenticated.spec.ts` lines 222 ("Article with cover"), 262 ("Brand new piece"), 291 ("Publish me"), 372 ("With inline image") use hardcoded titles. These map to deterministic slugs (`article-with-cover`, `brand-new-piece`, etc.). On persistent dev/staging test backends, the second run hits the slug-uniqueness check and `create` fails — producing a redirect-assertion timeout rather than a meaningful failure.

The FR-12 draft-visibility test at line 439 already uses the correct pattern (`Draft visibility ${Date.now()}`); these four tests were missed.

**Risk:** intermittent CI failures on shared test backends, masking real bugs.

## Goal

Each create-path test produces a unique slug per run; assertions match the slug shape without exact-string coupling.

## Scope

- Suffix each hardcoded title with `${Date.now()}` (or a UUID fragment).
- Update the URL-shape regex assertions in each test to match the slug-with-suffix pattern.

## Out of Scope

- Changing the slug-conflict test (line 399) which deliberately tests the conflict path.
- Adding test-isolation infrastructure.

## Approach

Mirror the FR-12 pattern: build a unique title once per test, derive the expected slug pattern from it, and use a regex match in the URL assertion.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. In `apps/mirror/e2e/article-editor.authenticated.spec.ts`, at line 222, change `fill('Article with cover')` to `const title = \`Article with cover ${Date.now()}\`; ... fill(title)`.
2. Update the corresponding URL-shape assertion to match `new RegExp(\`/articles/article-with-cover-\\\\d+/edit\`)`.
3. Repeat for lines 262, 291, 372.
4. Run `pnpm --filter=@feel-good/mirror test:e2e -- article-editor` twice in succession against the same backend; both runs must pass.

## Constraints

- Do not break the slug-conflict test at line 399 — that one MUST keep its hardcoded slug.
- Keep test names readable.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- CodeRabbit thread: https://github.com/hpark0011/mirror/pull/34#discussion_r3180086669
- Existing pattern: `apps/mirror/e2e/article-editor.authenticated.spec.ts:439`
