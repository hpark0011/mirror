---
title: Multi-Agent Todo Orchestration Strategy
category: workflow
tags: [agents, orchestration, todo-clearing, claude-code]
date: 2026-02-06
---

# Multi-Agent Todo Orchestration Strategy

## Problem

When clearing a backlog of code todos with AI agents, naive parallelization causes:
- Merge conflicts when multiple agents edit the same file
- Semantic conflicts where changes interact poorly
- Cascading build failures that block all agents
- Lost work from conflicting edits

## Core Strategy: File-Aware Dependency Grouping

### Principle: Parallelize by file, serialize by function

Tasks touching **different files** can run in parallel. Tasks touching the **same file** (especially the same function) must run sequentially to avoid merge conflicts and semantic interactions.

### File Overlap Analysis

Before dispatching agents, map every pending todo to the files it modifies. Group them:

1. **Independent Group**: Tasks touching unique files → parallelize freely
2. **Same-File Group**: Tasks touching the same file → serialize within the group
3. **Same-Function Group**: Tasks modifying the same function body → strict ordering required

### Quality Gates Between Groups

After each group completes:
```bash
pnpm build --filter=@feel-good/mirror   # Type check + build
pnpm lint --filter=@feel-good/mirror    # Lint check
```

Only proceed to the next group if gates pass. This prevents cascading failures.

## Agent Orchestration Pattern for Claude Code

### Recommended: Sequential Phases with Parallel Lanes

```
Phase 1 (Parallel Lanes)           Phase 2 (Sequential)        Phase 3 (Parallel)
┌──────────────────────┐           ┌──────────────────┐        ┌──────────────────┐
│ Lane A: types.ts     │           │ use-otp-auth.ts  │        │ Lane A: e2e tests│
│ Lane B: schemas      │  →BUILD→  │ (5 todos in      │ →BUILD→│ Lane B: review   │
│ Lane C: convex/email │           │  strict order)   │        │ Lane C: cleanup  │
│ Lane D: dead blocks  │           └──────────────────┘        └──────────────────┘
│ Lane E: otp-view.tsx │
└──────────────────────┘
```

### Implementation with Claude Code

**Option A: Single-Session Task Agent (Recommended for <15 todos)**
- Use one Claude Code session as the orchestrator
- Dispatch `Task` tool subagents for truly independent work (different files)
- Handle same-file edits sequentially in the main session
- Run build gates between phases

**Option B: Team-Based Multi-Agent (Better for >15 todos)**
- Use `TeamCreate` to establish a team with task list
- Assign file-independent tasks to different teammates
- Leader serializes same-file work
- Shared task list tracks progress and dependencies

### Minimizing Human Intervention

1. **Self-validating**: Run `pnpm build` after each edit group
2. **Self-correcting**: If build fails, agent reads error and fixes before proceeding
3. **Atomic commits**: Commit after each completed todo for easy rollback
4. **Clear acceptance criteria**: Each todo has testable criteria agents can verify

### Common Failure Modes to Avoid

| Failure Mode | Prevention |
|---|---|
| Merge conflict on same file | Serialize all edits to the same file |
| Semantic conflict (changes interact) | Order dependent changes (e.g., extract handler before refactoring callers) |
| Build cascade failure | Quality gate between phases |
| Agent edits stale file content | Re-read file before each edit in sequential chains |
| Over-engineering | Follow todo acceptance criteria exactly, don't add extras |

## Applied to Our Todo Backlog

### Dependency Graph

```
#021 — SKIP (deliberate)

Independent (Phase 1 parallel):
  #067 → types.ts only
  #072 → blocks/ file deletion only
  #079 → schemas only
  #080 → views/otp-view.tsx only
  #076 + #081 → convex/email.ts (same file, non-conflicting lines)

Sequential (Phase 2, use-otp-auth.ts):
  #078 → extract error handler (simplifies file first)
  #074 → cooldown timer perf (refactors deps)
  #073 → add loading state to resend
  #075 → cooldown reset on failure
  #077 → remove window.location (touches verifyOTP, not resend)

Standalone (Phase 3):
  #082 → e2e tests (independent app)
```

### Recommended Ordering Rationale

**#078 before #073/#074/#075**: Extracting the error handler first reduces the function body size, making subsequent refactors cleaner and reducing the chance of overlapping edits.

**#074 before #073**: The cooldown ref refactor changes the dependency arrays. Adding loading state (#073) is easier on a clean dependency structure.

**#073 before #075**: Loading state changes how resendOTP flows. Moving cooldown to onSuccess (#075) should build on the updated flow.

**#077 last in the sequence**: It touches `verifyOTP` (not `resendOTP`), so it's independent of the resend chain but still modifies the same file. Doing it last avoids line-number drift.
