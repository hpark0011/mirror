---
status: completed
priority: p2
issue_id: "234"
tags: [code-review, security, greyboard-desktop]
dependencies: []
---

# Add .md Extension and NUL Byte Enforcement to Validator

## Problem Statement

The `readFilePayloadSchema` validates that file names don't contain path separators or `..`, but does not enforce that the file must have a `.md` extension. The renderer could request any file inside the selected folder (e.g., `.env`, `LICENSE`, hidden files). Also missing: NUL byte check and max length.

## Findings

- **Security Sentinel**: No `.md` enforcement in Zod schema. No NUL byte rejection. No max filename length.
- **Pattern Recognition**: Validator is more sophisticated than the old `exportBoardPayloadSchema` but misses these refinements.

**Affected file:** `apps/greyboard-desktop/electron/lib/validators.ts` (lines 8-17)

## Proposed Solutions

### Option A: Add refinements (Recommended)
```typescript
.max(255, 'File name too long')
.refine((name) => !name.includes('\0'), { message: 'Invalid file name' })
.refine((name) => name.endsWith('.md'), { message: 'Only markdown files allowed' })
```
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Schema rejects filenames without `.md` extension
- [ ] Schema rejects filenames with NUL bytes
- [ ] Schema enforces max length of 255

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | Defense in depth for file type restriction |
