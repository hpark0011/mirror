---
id: FG_108
title: "Inline-image test coverage gaps closed: NFR-03 perf, drop unit, posts upload hook"
date: 2026-05-02
type: chore
status: completed
priority: p2
description: "Three spec-mandated or pattern-mandated test files are missing or weak: NFR-03 requires a 500-node body-walk perf regression test (absent), the ProseMirror plugin handleDrop path has no unit test (different code path from handlePaste), and use-post-inline-image-upload has no test file mirroring the articles hook (FR-11 client validation only verified on articles surface). Add all three to close the testing-reviewer findings."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "packages/convex/convex/content/__tests__/body-walk.test.ts has a test that builds a 500-image-node body, calls extractInlineImageStorageIds, and asserts duration <50ms"
  - "packages/features/editor/__tests__/inline-image-upload-plugin.test.ts has a test that dispatches a drop event with one or more image files via DataTransfer + clientX/clientY and asserts placeholder + image insertion"
  - "apps/mirror/features/posts/__tests__/use-post-inline-image-upload.test.ts exists and mirrors the articles hook test (GIF rejected, oversize PNG rejected, valid WEBP accepted)"
  - "All three new tests pass: pnpm --filter=@feel-good/convex test && pnpm --filter=@feel-good/features test && pnpm --filter=@feel-good/mirror build"
  - "Existing tests still pass"
owner_agent: "Test coverage / Convex + Vitest specialist"
---

# Inline-image test coverage gaps closed: NFR-03 perf, drop unit, posts upload hook

## Context

ce:review (`feature-add-editor`, 2026-05-02) Findings #26, #27, #29 — all from the testing reviewer at confidence 0.85+. Three independent gaps grouped because they're all "add a missing test that the spec or established pattern requires":

**Gap 1 — NFR-03 (Finding #26, P2, conf 0.95):** Spec NFR-03 requires:
> Vitest: 500-node body completes <50ms (loose budget — guards against quadratic regressions).

`packages/convex/convex/content/__tests__/body-walk.test.ts` ends at line 209 with no timing assertion. A future change that introduces O(n²) behavior would not be caught until production shows slow `update` mutations.

**Gap 2 — drop path unit test (Finding #27, P2, conf 0.88):** `inline-image-upload-plugin.ts:200` `handleDrop` uses `view.posAtCoords({ left, top })` — meaningfully different from `handlePaste`'s `view.state.selection.from`. All six existing plugin unit tests fire paste events. The E2E drop spec is `test.fixme` (FG_094 territory). Net: `posAtCoords` is entirely uncovered.

**Gap 3 — posts upload-hook test (Finding #29, P2, conf 0.85):** `apps/mirror/features/articles/__tests__/use-article-inline-image-upload.test.ts` exists and covers FR-11. `apps/mirror/features/posts/__tests__/use-post-inline-image-upload.test.ts` does NOT exist. A copy-paste divergence (e.g., dropping the size check) would not be caught.

## Goal

After this ticket, all three coverage gaps are filled. NFR-03's regression guard exists, the drop path has unit coverage, and posts has the same FR-11 client-validation coverage as articles.

## Scope

- Add a NFR-03 perf test to `body-walk.test.ts`.
- Add a drop-event unit test to `inline-image-upload-plugin.test.ts`.
- Create `apps/mirror/features/posts/__tests__/use-post-inline-image-upload.test.ts` mirroring the articles version.

## Out of Scope

- Resolving the E2E `test.fixme` blockers (FG_094 territory).
- Refactoring the upload hook validation logic (FG_106 territory) — this ticket only adds a parallel test file.
- Adding broader perf-regression infrastructure (e.g., benchmarking framework).

## Approach

**NFR-03 perf test:**

```ts
it("extractInlineImageStorageIds completes <50ms on a 500-image-node body (NFR-03)", () => {
  const content: JSONContent[] = Array.from({ length: 500 }, (_, i) => ({
    type: "image",
    attrs: { storageId: `mock-${i}` },
  }));
  const body: JSONContent = { type: "doc", content };
  const start = performance.now();
  const out = extractInlineImageStorageIds(body);
  const duration = performance.now() - start;
  expect(out.length).toBe(500);
  expect(duration).toBeLessThan(50);
});
```

**Drop unit test:** Build a `DataTransfer` with one image File, dispatch a `DragEvent` (happy-dom or jsdom; check what the existing plugin tests use), supply `clientX`/`clientY` that map to a valid pos, assert a placeholder appears at the expected position. Resolve the upload, assert the image node lands at the same position.

**Posts upload-hook test:** Copy `apps/mirror/features/articles/__tests__/use-article-inline-image-upload.test.ts` byte-for-byte, change the import path and entity references, save as `apps/mirror/features/posts/__tests__/use-post-inline-image-upload.test.ts`. After FG_106 lands, both test files should be slim and largely focused on hook integration; today they each test the validation logic.

- **Effort:** Small (each)
- **Risk:** Low — pure test additions.

## Implementation Steps

1. Add the NFR-03 perf test to `packages/convex/convex/content/__tests__/body-walk.test.ts`.
2. Add the drop-path unit test to `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts` — examine the existing paste tests for the helper / harness pattern.
3. Create `apps/mirror/features/posts/__tests__/use-post-inline-image-upload.test.ts` mirroring the articles test.
4. Run `pnpm --filter=@feel-good/convex test`, `pnpm --filter=@feel-good/features test`, and `pnpm --filter=@feel-good/mirror build`.
5. Verify all three new tests pass and no existing tests regress.

## Constraints

- The 50ms NFR-03 budget is "loose" per spec — don't tighten it. CI variability could flake a tighter budget.
- Drop test must use a real DOM-shaped `DragEvent` (via happy-dom or equivalent), not a mocked array.
- Posts upload-hook test should follow the articles file's structure exactly so divergence is visible in code review.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Findings #26, #27, #29.
- Spec NFR-03.
- `apps/mirror/features/articles/__tests__/use-article-inline-image-upload.test.ts` — template for posts test.
- `packages/features/editor/__tests__/inline-image-upload-plugin.test.ts:150-188` — concurrent-uploads test pattern (template for drop test).
