---
version: 1
id: ISSUE-7
title: Update stale health.md docs after video-call removal from AGENTS.md
status: done
priority: low
assignee: null
agentExecution: null
sortOrder: 65534
labels:
  - code-review
  - nit
  - docs
blockedBy: []
parentId: ISSUE-2
projectId: null
worktree:
  enabled: true
  baseRef: main
createdBy: agent
updatedBy: agent
createdAt: 2026-08-03T05:01:51.497Z
updatedAt: 2026-08-03T05:03:16.161Z
completedAt: 2026-08-03T05:03:16.161Z
---
Code review finding (P3, nit) from ISSUE-2 review of branch `greyboard/ISSUE-2-remove-tavus-api`.

**Issue:** `apps/mirror/AGENTS.md` was correctly updated in this PR to remove all video-call/Tavus references, but the context health trackers `.claude/health.md:10` and `.agents/health.md:10` still say:

```
| AGENTS.md (mirror) | Current | Onboarding, video-call features added |
```

This is now inaccurate — the doc is marked "Current" while citing a feature (video-call) that no longer exists.

**Risk:** these health trackers exist specifically to flag when AGENTS.md content drifts from reality. Leaving a "Current" status pointing at removed content defeats their purpose and could mislead someone who trusts the tracker without re-diffing AGENTS.md themselves.

**Suggested fix:** update the Notes column for the `AGENTS.md (mirror)` row in both `.claude/health.md` and `.agents/health.md` to drop the "video-call features added" phrase (e.g. "Onboarding features added").

**Files:** `.claude/health.md:10`, `.agents/health.md:10`