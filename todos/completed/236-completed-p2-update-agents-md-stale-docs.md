---
status: completed
priority: p2
issue_id: "236"
tags: [code-review, documentation, greyboard-desktop]
dependencies: []
---

# Update AGENTS.md — Stale Documentation

## Problem Statement

`apps/greyboard-desktop/AGENTS.md` still documents the deleted board system: `files.ts` in project structure, `board-store.ts`, `schema.ts`, `FILES_IMPORT_BOARD` channel examples, and the entire "Board Schema" section. No mention of the `docs` IPC namespace, `document-store.ts`, or the new routes.

## Findings

- **Architecture Strategist**: High priority — stale docs actively mislead AI agents.

**Affected file:** `apps/greyboard-desktop/AGENTS.md`

## Proposed Solutions

### Option A: Update AGENTS.md (Recommended)
- Replace board-related sections with document-related equivalents
- Update project structure, IPC pattern examples, state management section
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No references to `files.ts`, `board-store.ts`, `schema.ts`, or board channels
- [ ] Documents `docs.ts`, `document-store.ts`, document routes, doc channels
- [ ] IPC pattern example updated to use `docs` namespace

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-19 | Identified via code review (dd1cb50b) | AGENTS.md is the primary AI onboarding doc |
