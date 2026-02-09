---
status: completed
priority: p2
issue_id: "101"
tags: [code-review, react19, mirror]
dependencies: []
---

# forwardRef Unnecessary in React 19

## Problem Statement

`SheetContainer` uses `forwardRef` which is legacy API in React 19. React 19 supports `ref` as a regular prop, so the `forwardRef` wrapper is unnecessary complexity.

## Findings

- **Source:** kieran-typescript-reviewer, code-simplicity-reviewer agents
- **Location:** `apps/mirror/app/(protected)/dashboard/_components/sheet-container.tsx` lines 3, 15
- **Evidence:** Project uses React 19 (confirmed by `package.json` peer dep `"react": "^19.0.0"`).

## Proposed Solutions

### Option A: Convert to regular prop (Recommended)
```typescript
type SheetContainerProps = {
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
  // ... other props
};

export function SheetContainer({ ref, children, ... }: SheetContainerProps) {
```
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] No `forwardRef` import or usage
- [ ] `ref` passed as regular prop
- [ ] Component functions identically

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from PR #105 round 2 review | React 19 makes forwardRef unnecessary |

## Resources

- PR: https://github.com/hpark0011/feel-good/pull/105
