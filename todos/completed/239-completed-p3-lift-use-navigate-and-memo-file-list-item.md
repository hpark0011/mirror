---
status: completed
priority: p3
issue_id: "239"
tags: [code-review, performance, greyboard-desktop]
dependencies: []
---

# Lift useNavigate() and Memoize FileListItem

## Problem Statement

Each `FileListItem` instance calls `useNavigate()`, creating a separate router context subscription per item. With 1000 files, that's 1000 subscriptions. The component also re-renders on any parent render since it's not memoized.

## Findings

- **Performance Oracle**: Lift `useNavigate()` to parent, pass callback. Memoize with `React.memo`.

**Affected file:** `apps/greyboard-desktop/src/routes/document-list.tsx` (lines 108-130)

## Proposed Solutions

### Option A: Lift navigate + memo (Recommended)
- Move `useNavigate()` to `DocumentList`
- Pass `onClick` callback to `FileListItem`
- Wrap `FileListItem` in `React.memo`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] `useNavigate()` called once in parent, not per-item
- [ ] `FileListItem` wrapped in `React.memo`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | Per-item hook subscriptions scale poorly |
