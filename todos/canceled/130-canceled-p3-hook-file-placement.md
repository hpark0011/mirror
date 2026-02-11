---
status: canceled
priority: p3
issue_id: "130"
tags: [code-review, conventions, folder-structure, mirror]
dependencies: []
---

# Hook file in _components/ instead of hooks directory

## Problem Statement

`use-nav-direction.ts` is a custom hook placed inside `_components/`, which is designated for "Route-specific UI components" per the folder-structure convention. Hooks should live in `features/<feature>/hooks/` or the app-level `hooks/` directory.

## Findings

- **Pattern Recognition (P2 -> P3):** The `_hooks/` convention is legacy, and there is no convention-defined active alternative for dashboard-scoped hooks that aren't feature-scoped. This is a gray area.
- **Code Simplicity Reviewer:** Keeping it separate is justified given the side-effect nature of the hook.

## Proposed Solutions

### Option A: Move to app-level hooks/

Move to `apps/mirror/hooks/use-nav-direction.ts` since it serves the entire dashboard shell.

- **Effort:** Small
- **Risk:** Low

### Option B: Keep in _components/

Accept the convention deviation since the hook is tightly coupled to the dashboard route.

- **Effort:** None
- **Risk:** None

## Technical Details

- **Affected files:** `apps/mirror/app/(protected)/dashboard/_components/use-nav-direction.ts`

## Acceptance Criteria

- [ ] Hook location follows project conventions

## Work Log

- 2026-02-11: Created from PR #113 code review. Low priority — borderline acceptable.

## Resources

- PR #113: https://github.com/hpark0011/feel-good/pull/113
- `.claude/rules/folder-structure.md`
