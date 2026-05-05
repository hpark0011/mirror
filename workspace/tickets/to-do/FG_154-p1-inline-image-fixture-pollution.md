---
id: FG_154
title: "Inline-image E2E specs share one draft fixture and pollute each other in parallel runs"
date: 2026-05-05
type: fix
status: to-do
priority: p1
description: "All 6 article-inline-image-*.authenticated.spec.ts specs (paste, drop, replace, cascade-delete, mime-limit, size-limit) call the same `/test/ensure-article-fixtures` endpoint, which returns ONE shared `draftSlug` per test user. Under default-parallel Playwright execution (5 workers), specs that save image bodies into that shared draft race and overwrite each other, producing non-deterministic 'leftover image' / 'image count off by one' failures. The 5 individual specs pass in isolation; the full-suite parallel run fails on a different subset every time."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "`pnpm --filter=@feel-good/mirror test:e2e -- inline-image` reports 16/16 tests green across all 8 specs in default-parallel mode."
  - "Running the same command twice in succession against the same backend reports 16/16 green both runs (no cross-run pollution either)."
  - "Each `article-inline-image-*` spec opens a fixture draft whose slug is unique to that spec (and ideally to that test/run), so a parallel sibling's save into a different draft cannot affect this spec's body assertions."
  - "The shared `ensureTestArticleFixtures` helper inlined into each spec is removed in favor of a single source of truth (e.g. `apps/mirror/e2e/fixtures/article-fixtures.ts`) so the per-spec uniqueness rule cannot drift between specs."
  - "`pnpm --filter=@feel-good/mirror lint` and `pnpm --filter=@feel-good/mirror build` pass."
owner_agent: "test engineer (Playwright + Convex)"
---

# Inline-image E2E specs share one draft fixture and pollute each other in parallel runs

## Context

Surfaced during FG_153 verification (2026-05-05). Once FG_153's plugin fix made paste/drop actually insert images, the full-suite run started failing on a different subset of specs each invocation:

- Run 1: 1 failure in `article-inline-image-paste`.
- Run 2: 2 failures in `article-inline-image-drop` + `article-inline-image-replace` (the replace spec showed `locator resolved to 2 elements when expected 1` — a sibling spec's saved image leaked into the editor mount).

All 6 `article-inline-image-*.authenticated.spec.ts` specs inline the same helper:

```ts
async function ensureTestArticleFixtures(): Promise<{ draftSlug; publishedSlug }> {
  const res = await fetch(`${convexSiteUrl}/test/ensure-article-fixtures`, ...);
  ...
}
```

That endpoint (`packages/convex/convex/http.ts:158` → `internal.auth.testHelpers.ensureTestArticleFixtures`) creates ONE draft article per test user and returns its slug. With Playwright running 5 workers by default, multiple specs land on `/@user/articles/<same-draft>/edit` concurrently; each spec's save mutation overwrites the previous one's body. The `mime-limit` and `size-limit` specs don't save (they only assert pre-Convex client validation), but `paste`, `drop`, `replace`, and `cascade-delete` all save inline-image bodies.

This is **distinct from FG_135**, which targets `apps/mirror/e2e/article-editor.authenticated.spec.ts` — the *create-path* tests where hardcoded titles produce deterministic slugs that collide on persistent backends across consecutive runs. FG_135's fix (suffix titles with `Date.now()` so the create produces a unique slug) does not apply here: the inline-image specs don't create articles, they open a server-seeded fixture draft. Different mechanism, different fix.

**Risk:** the inline-image E2E suite is now structurally non-deterministic — false-FAILs in CI mask real regressions to FR-01/02/03/06/07. Blocks FG_153 promotion (its AC #6 demands 16/16 in default-parallel mode) and FG_094 (same dependency on AC #5).

## Goal

Each spec that saves an inline-image body operates on its own server-seeded draft, so parallel siblings cannot pollute each other's body assertions. Full-suite default-parallel run is deterministic at 16/16.

## Scope

- A per-spec (or per-test) fixture draft pattern. Two reasonable shapes:
  1. Extend `ensureTestArticleFixtures` to take a `slugSuffix` (or `key`) parameter — e.g. `ensureTestArticleFixtures({ key: 'article-inline-image-paste' })` returns a draft with slug `inline-paste-fixture-draft-{key}`. The server upserts by `(userId, slug)` so repeat calls return the same row.
  2. Generate a unique draft per test invocation (`crypto.randomUUID()` suffix) and clean up via the existing cascade-delete path (or accept the leftover drafts on the test backend — they're already marked test-only).
- Centralize the helper in a single fixture file (`apps/mirror/e2e/fixtures/article-fixtures.ts` or similar) — the inlined-per-spec copies have already drifted slightly between specs and will keep drifting.
- Update each `article-inline-image-*.authenticated.spec.ts` to import the centralized helper with the appropriate per-spec key.

## Out of Scope

- The `post-inline-image-paste` and `post-markdown-image-import` specs use a different fixture path (`/test/ensure-post-fixtures`, scoped per post slug) and aren't affected by this pollution. Don't touch them.
- FG_135's create-path slug-collision fix — orthogonal.
- Migrating away from the shared `convex-test` backend. The fix is at the per-spec fixture level.

## Approach

Recommend shape (1) above — a `key`-parameterized server endpoint — because:

- The number of distinct keys is small (one per inline-image spec, ~6 total) so the test backend doesn't accumulate per-run drafts.
- Repeat-run idempotence is preserved (same key → same upserted row → same slug across runs).
- The cascade-delete spec specifically asserts the slug it's about to delete is the same one it just saved into; a stable per-spec key keeps that assertion honest without introducing UUIDs.

Server-side: extend `internal.auth.testHelpers.ensureTestArticleFixtures` to accept an optional `key: string` and use it in the slug derivation (e.g., `inline-${key}-fixture-draft`). Falls back to the current behavior when `key` is absent so non-inline-image specs aren't disturbed.

Client-side: replace the 6 inlined `ensureTestArticleFixtures` helpers with a single import from `apps/mirror/e2e/fixtures/article-fixtures.ts`. Each spec passes its own key:

```ts
const { draftSlug } = await ensureTestArticleFixtures({ key: 'paste' });
```

- **Effort:** Medium (server endpoint change + 6 spec updates + central helper)
- **Risk:** Low — non-test code is unaffected; the key parameter is additive

## Implementation Steps

1. Extend `packages/convex/convex/auth/testHelpers.ts` (the `ensureTestArticleFixtures` mutation) to accept `args.key?: v.string()` and derive `draftSlug = key ? \`inline-${key}-fixture-draft\` : 'fixture-draft'` (preserving current behavior when key is omitted).
2. Update `packages/convex/convex/http.ts:158` to forward the optional key from request body.
3. Create `apps/mirror/e2e/fixtures/article-fixtures.ts` exporting `ensureTestArticleFixtures(opts?: { key?: string })` — single source of truth.
4. Replace the inlined helper in each of the 6 `article-inline-image-*.authenticated.spec.ts` files with the import. Pass the spec's name (or a short key) per spec.
5. Run `pnpm --filter=@feel-good/mirror test:e2e -- inline-image` twice in succession; both runs must be 16/16.
6. Run `pnpm --filter=@feel-good/mirror build` and `pnpm --filter=@feel-good/mirror lint`.
7. Once green, edit FG_153 frontmatter (move FG_154 out of any cross-reference) and re-run the FG_094 verifier as the final step in the unblock chain.

## Constraints

- The cascade-delete spec relies on `slugToRemove === draftSlug`; after the change, the per-spec key for `cascade-delete` must be stable so a re-open after delete still resolves the same row (or — depending on implementation — the spec needs to fixture a fresh draft per test invocation).
- Don't break the `mime-limit` and `size-limit` specs — they read the fixture draft but don't save into it; they should keep working with whatever key they're assigned (or share a dedicated read-only key).
- Don't introduce a `Date.now()`-suffixed slug pattern here (that's FG_135's pattern for the create-path); upserts by stable per-spec key are cleaner for these specs.

## Resources

- FG_153 verifier report (2026-05-05) — the run-1 vs run-2 failure-set diff that diagnosed the pollution.
- `packages/convex/convex/http.ts:158` — the test endpoint.
- `packages/convex/convex/auth/testHelpers.ts` — the mutation that creates the fixture draft.
- `apps/mirror/e2e/article-inline-image-cascade-delete.authenticated.spec.ts:122-123` — the cross-spec slug equality assertion that constrains the key shape.
- FG_135 — sibling but distinct slug-collision ticket (create-path, not fixture-pollution).
