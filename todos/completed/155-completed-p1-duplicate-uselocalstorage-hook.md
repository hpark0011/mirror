---
status: completed
priority: p1
issue_id: "155"
tags: [code-review, duplication, monorepo, mirror, greyboard]
dependencies: []
---

# Duplicate useLocalStorage Hook Violates Code Promotion Ladder

## Problem Statement

`apps/mirror/hooks/use-local-storage.ts` and `apps/greyboard/hooks/use-local-storage.ts` are byte-for-byte identical (132 lines each). This non-trivial hook includes SSR safety, cross-tab sync via StorageEvent, same-tab sync via CustomEvent + queueMicrotask, and QuotaExceededError handling. Per the project's `folder-structure.md` code promotion ladder: "Used by 2+ apps → Package-level (packages/utils/, packages/features/)". This duplication creates silent divergence risk — bug fixes or improvements in one copy will be missed in the other.

## Findings

- **Source:** All 6 review agents flagged this unanimously
- **Location:** `apps/mirror/hooks/use-local-storage.ts` (132 lines), `apps/greyboard/hooks/use-local-storage.ts` (132 lines)
- **Evidence:** Files differ only by trailing newline. Hook used by 8 consumers in greyboard and 1+ in mirror.

## Proposed Solutions

### Option A: Extract to shared package (Recommended)
- Create `packages/utils/src/use-local-storage.ts`
- Export from `@feel-good/utils/use-local-storage`
- Update both apps to import from the shared package
- **Effort:** Small
- **Risk:** Low

### Option B: Simplify for mirror, keep greyboard's copy
- Mirror only has 1 consumer — simplify to ~40 lines (drop cross-tab sync, custom events, clearValue)
- Keep greyboard's full version since it has 8 consumers
- Extract to shared package later when mirror needs the full version
- **Effort:** Small
- **Risk:** Low (but defers the promotion)

## Acceptance Criteria

- [ ] No duplicate `useLocalStorage` implementations across apps
- [ ] Both apps import from the same source
- [ ] All existing consumers continue to work without behavior changes
- [ ] `pnpm build` passes for all 3 apps

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | 6/6 agents identified this as the top priority finding |

## Resources

- PR: #120
- Promotion ladder: `.claude/rules/folder-structure.md`
- Greyboard consumers: `apps/greyboard/hooks/use-local-storage.ts`
- Mirror consumer: `apps/mirror/hooks/use-local-storage.ts`
