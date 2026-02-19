---
status: completed
priority: p2
issue_id: "232"
tags: [code-review, architecture, greyboard-desktop]
dependencies: []
---

# Remove Zustand Persist Middleware — Dual Source of Truth

## Problem Statement

`folderPath` is persisted in two independent stores:
1. Main process: `docs-settings.json` in `userData` (authoritative)
2. Renderer: Zustand `persist` to `localStorage` under key `greyboard-desktop:documents`

On page reload, Zustand hydrates `folderPath` from localStorage *before* `loadFolder()` calls the main process. This creates a window where the renderer briefly shows a stale folder path that may have been cleared or changed in the main process. The renderer-side persistence adds zero value.

## Findings

- **TypeScript Reviewer**: Blocking finding — dual persistence is misleading, remove persist middleware.
- **Architecture Strategist**: Medium risk — dual source of truth creates flash of stale state.
- **Simplicity Reviewer**: YAGNI violation — renderer copy is never authoritative.
- **Security Sentinel**: Folder path in localStorage is less secure than main process storage.

**Affected file:** `apps/greyboard-desktop/src/state/document-store.ts` (lines 81-84)

## Proposed Solutions

### Option A: Remove persist middleware (Recommended)
- Remove `persist` wrapper, `partialize`, and storage name config
- Store starts with `folderPath: null`, populated by `loadFolder()` on mount
- **Pros**: Single source of truth, simpler code, ~6 lines removed
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] `persist` middleware removed from `document-store.ts`
- [ ] `folderPath` starts as `null` and is populated by `loadFolder()`
- [ ] No `greyboard-desktop:documents` key written to localStorage

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | Main process persistence is the single source of truth |
