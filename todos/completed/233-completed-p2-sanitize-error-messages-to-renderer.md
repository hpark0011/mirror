---
status: completed
priority: p2
issue_id: "233"
tags: [code-review, security, greyboard-desktop]
dependencies: []
---

# Sanitize Error Messages Passed to Renderer

## Problem Statement

The `DOCS_READ_FILE` handler throws errors that include Zod validation details and could include OS-level error messages with absolute file paths (from `stat()` or `readFile()` failures). These errors are serialized across the IPC bridge and displayed in the UI via `document-view.tsx`.

## Findings

- **Security Sentinel**: OS-level errors (EACCES, ENOENT) can leak absolute paths from error messages. Zod error messages include schema details.
- **TypeScript Reviewer**: Error display in `document-view.tsx` line 56 passes `err.message` directly to the UI.

**Affected files:**
- `apps/greyboard-desktop/electron/ipc/docs.ts` (lines 129-155)
- `apps/greyboard-desktop/src/routes/document-view.tsx` (line 56)

## Proposed Solutions

### Option A: Wrap file operations in try/catch with sanitized messages (Recommended)
- Catch all errors in the file operations section
- Log detailed errors to main process console
- Throw generic user-facing messages
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] File system errors return generic messages like "Could not read file"
- [ ] Detailed errors logged to main process console for debugging
- [ ] No absolute paths exposed in renderer error messages

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | IPC error serialization passes full error messages |
