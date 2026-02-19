---
status: completed
priority: p3
issue_id: "240"
tags: [code-review, quality, greyboard-desktop]
dependencies: []
---

# Cleanup: Remove Unused Schemas and Merge Duplicate Store Actions

## Problem Statement

1. `documentFileSchema` and `documentFileListSchema` in `validators.ts` are exported but never imported — dead code.
2. `refreshFiles` in `document-store.ts` is nearly identical to `loadFolder` — can be consolidated.
3. `folderPath.split('/')` in `document-list.tsx` doesn't handle Windows backslashes.

## Findings

- **Simplicity Reviewer**: ~22 lines removable via consolidation.
- **Pattern Recognition**: Unused schemas noted.
- **TypeScript Reviewer**: Path separator is platform-dependent.

## Proposed Solutions

### Option A: Consolidate all three (Recommended)
- Remove `documentFileSchema` + `documentFileListSchema`
- Merge `refreshFiles` into `loadFolder` with conditional error message
- Fix path split to `folderPath.split(/[/\\]/).pop()`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No unused exports in `validators.ts`
- [ ] Single `loadFolder` method handles both initial load and refresh
- [ ] Path display works on both macOS and Windows

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | Keep validators minimal, avoid duplicate store actions |
