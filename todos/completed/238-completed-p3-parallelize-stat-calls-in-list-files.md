---
status: completed
priority: p3
issue_id: "238"
tags: [code-review, performance, greyboard-desktop]
dependencies: []
---

# Parallelize stat() Calls in DOCS_LIST_FILES

## Problem Statement

`DOCS_LIST_FILES` calls `stat()` sequentially for each `.md` file. On network-mounted volumes, 500 files could take 2.5-25 seconds. On local SSD it's fine for moderate counts.

## Findings

- **Performance Oracle**: Critical at scale. Sequential `stat()` is the main I/O bottleneck.

**Affected file:** `apps/greyboard-desktop/electron/ipc/docs.ts` (lines 96-124)

## Proposed Solutions

### Option A: Batched Promise.allSettled with concurrency limit
- Filter `.md` entries first, then stat in batches of ~20
- ~20x improvement for network drives
- **Effort**: Small
- **Risk**: Low

### Option B: Add file count cap (simpler)
- Return max 500 files with truncation indicator
- Defers the problem to Phase 2
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] stat() calls are parallelized or file count is capped
- [ ] Large folder performance is reasonable (<2s for 500 files local)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | Sequential await in loop is O(n) latency |
