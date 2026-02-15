---
status: completed
priority: p2
issue_id: "182"
tags: [documentation, claude-md, mirror, context-guardian]
dependencies: []
---

# CLAUDE.md & Documentation Cleanup

## Problem Statement

Context guardian audit (2026-02-13) found multiple stale references, outdated descriptions, and orphaned files across project documentation. These create misleading context for both humans and AI agents.

## Findings

### Critical

1. **Root CLAUDE.md references nonexistent `CLAUDE.local.md.example`** — line 181 mentions copying this file, but it doesn't exist at the project root.

2. **Orphaned `PR_REVIEW_117.md` at project root** — one-off PR review file doesn't belong at root. Issues it raised appear addressed in subsequent commits (PR #119, #120, #121, #122). Move to `docs/` or delete.

3. **`health.md` is 14 days stale** — last synced 2026-01-30. 596 commits since. Should be regenerated.

### High

4. **Mirror description outdated in root CLAUDE.md** — Apps table says "Auth dashboard (Convex + Better Auth)" but mirror is now a full blogging platform with articles feature (34 files), profile pages, workspace layout, etc.

   ```diff
   - | mirror | Auth dashboard (Convex + Better Auth) | 3001 |
   + | mirror | Interactive blogging platform (Convex + Better Auth) | 3001 |
   ```

5. **Mirror app CLAUDE.md significantly outdated** — created 2026-01-30, doesn't reflect:
   - Articles feature growth (34 files: components, context, hooks, utils, views, lib)
   - App-level `components/` directory (workspace-navbar, workspace-toolbar-slot)
   - App-level `hooks/` directory (use-local-storage, use-nav-direction)
   - Profile feature expansion (context, actions, media components)
   - Workspace layout architecture (navbar/toolbar/content separation from PR #121)

6. **`features.md` pattern references "Delphi codebase"** — `.claude/commands/patterns/features.md` line 11 says "the Delphi codebase" instead of "the Feel Good monorepo". Remnant from template/previous project.

## Acceptance Criteria

- [ ] Remove or fix `CLAUDE.local.md.example` reference in root CLAUDE.md
- [ ] Move or delete `PR_REVIEW_117.md` from project root
- [ ] Regenerate `health.md`
- [ ] Update mirror description in root CLAUDE.md Apps table
- [ ] Update mirror app CLAUDE.md with current feature state
- [ ] Fix "Delphi codebase" → "Feel Good monorepo" in features.md pattern

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from context guardian audit | 14-day gap since last sync allowed significant doc drift |
