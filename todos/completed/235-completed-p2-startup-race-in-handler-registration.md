---
status: completed
priority: p2
issue_id: "235"
tags: [code-review, architecture, greyboard-desktop]
dependencies: []
---

# Race Condition on Handler Registration Startup

## Problem Statement

`registerDocHandlers` fires `loadPersistedFolder().then()` as a detached promise. If the renderer sends `DOCS_GET_FOLDER` or `DOCS_LIST_FILES` before that promise resolves, `selectedFolderPath` is still `null` and the user sees "no folder selected" despite having one persisted.

Also: concurrent mutations of module-level `selectedFolderPath` without synchronization. If `selectFolder` is called while `loadPersistedFolder` is in-flight, the old write could overwrite the user's selection.

## Findings

- **TypeScript Reviewer**: Blocking finding — race condition with detached promise.
- **Architecture Strategist**: Low practical risk but violates correctness.
- **Performance Oracle**: Startup race noted as correctness concern.

**Affected file:** `apps/greyboard-desktop/electron/ipc/docs.ts` (lines 46-49)

## Proposed Solutions

### Option A: Make registerDocHandlers async (Recommended)
- `await loadPersistedFolder()` before registering handlers
- Capture `selectedFolderPath` into local const at start of each handler
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] `registerDocHandlers` is async and awaits `loadPersistedFolder()`
- [ ] `registerAllHandlers` in `ipc/index.ts` awaits the call
- [ ] Each handler captures `selectedFolderPath` into a local const

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | Fire-and-forget `.then()` on startup creates timing issues |
