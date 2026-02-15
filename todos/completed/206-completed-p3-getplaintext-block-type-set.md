---
status: completed
priority: p3
issue_id: "206"
tags: [code-review, pr-124, quality, editor, performance]
dependencies: []
---

# getPlainText block-type check could use a Set for clarity

## Problem Statement

`getPlainText` in `get-plain-text.ts` checks block-level node types using a string comparison chain. Using a `Set` would be more maintainable and marginally faster for lookups, especially as new block types are added.

## Findings

- **Location:** `packages/features/editor/lib/get-plain-text.ts`
- Current: chained `type === "paragraph" || type === "heading" || ...` checks
- A `Set<string>` with `.has()` is cleaner and O(1) per lookup

## Proposed Solutions

### Option A: Extract block types to a Set (Recommended)

```typescript
const BLOCK_TYPES = new Set(["paragraph", "heading", "blockquote", "listItem", "codeBlock"]);

// Usage
if (BLOCK_TYPES.has(node.type)) { ... }
```

- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] Block-type check uses a Set instead of chained comparisons
- [ ] All existing block types are preserved
- [ ] getPlainText output is unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 TypeScript review | Set-based type checks are more maintainable than chained equality |
