---
status: completed
priority: p1
issue_id: "231"
tags: [code-review, security, greyboard-desktop]
dependencies: []
---

# Symlink Bypass in DOCS_READ_FILE Handler

## Problem Statement

The `DOCS_READ_FILE` IPC handler validates paths using `path.resolve()`, which is purely lexical — it does NOT follow symlinks. After the boundary check passes, `stat()` and `readFile()` DO follow symlinks. A symlink inside the selected folder pointing outside it (e.g., `evil-link.md -> /etc/passwd`) would pass the boundary check but read an arbitrary file.

Additionally, `DOCS_LIST_FILES` claims to skip symlinks, but `entry.isFile()` on a `Dirent` returns `true` for symlinks to regular files. The explicit `isSymbolicLink()` check mentioned in the plan doc is missing from the code.

## Findings

- **Security Sentinel**: `path.resolve` is string-based only, does not resolve symlinks. `stat()` and `readFile()` follow symlinks by default. TOCTOU race exists between listing and reading.
- **TypeScript Reviewer**: Confirmed `isFile()` returns true for symlinks to files on `Dirent` objects. The comment "Skip non-files, symlinks" on line 98 is misleading — no symlink check exists.
- **Architecture Strategist**: Path boundary check (line 143) is lexically correct but does not account for symlinks.

**Affected files:**
- `apps/greyboard-desktop/electron/ipc/docs.ts` (lines 99, 140-152)

## Proposed Solutions

### Option A: Use `realpath` + `lstat` (Recommended)
- Use `fs.realpath()` to resolve symlinks before the boundary check
- Use `lstat()` instead of `stat()` to detect symlinks
- Add `entry.isSymbolicLink()` check in `listFiles`
- **Pros**: Defense in depth, correct on all platforms
- **Cons**: Additional syscall per read
- **Effort**: Small
- **Risk**: Low

### Option B: `lstat` only
- Use `lstat()` to reject symlinks without resolving them
- Add `entry.isSymbolicLink()` check in `listFiles`
- **Pros**: Simpler, no need for `realpath`
- **Cons**: Doesn't handle nested symlink scenarios
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Option A — Use `realpath` + `lstat` for both listing and reading.

## Technical Details

**Affected files:**
- `apps/greyboard-desktop/electron/ipc/docs.ts`

**Acceptance Criteria:**
- [ ] `DOCS_LIST_FILES` explicitly skips `entry.isSymbolicLink()` entries
- [ ] `DOCS_READ_FILE` uses `fs.realpath()` before boundary check
- [ ] `DOCS_READ_FILE` uses `lstat()` to reject symlinks
- [ ] Symlink to file outside folder returns access denied error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | `path.resolve` is lexical-only; `isFile()` follows symlinks on Dirent |

## Resources

- Commit: dd1cb50b
- Branch: greyboard/feat-doc-list
