---
title: "feat: Multi-Agent Todo Backlog Clearing"
type: feat
date: 2026-02-06
---

# Multi-Agent Todo Backlog Clearing

## Overview

Orchestrate multiple Claude Code agents to clear 12 pending todos (#067-#082, excluding #021 which is deliberately skipped) from the auth/OTP code review backlog. The strategy uses file-aware dependency grouping: parallelize tasks touching different files, serialize tasks touching the same file.

## Problem Statement

12 pending todos remain from PR #104 code review. They range from simple dead code deletion to performance refactors and architectural changes. The critical challenge is that **5 todos all modify `use-otp-auth.ts`**, specifically overlapping on the `resendOTP` function body (lines 130-159). Naive parallelization would cause merge conflicts and semantic interactions.

## Proposed Solution

**Three-phase execution** with parallel lanes per phase and build gates between phases.

### Phase 1: Independent Changes (Parallel — 5 agents)

Tasks that touch completely different files, zero conflict risk.

| Agent | Todo | File(s) | Change |
|-------|------|---------|--------|
| A | **#067** | `packages/features/auth/types.ts` | Add `INVALID_OTP` and `TOO_MANY_ATTEMPTS` keys to `AUTH_ERROR_MESSAGES` (keep old keys for backward compat) |
| B | **#072** | `blocks/otp-login-block.tsx`, `blocks/otp-sign-up-block.tsx` | Delete both files, verify no imports exist |
| C | **#079** | `lib/schemas/auth.schema.ts`, `lib/schemas/index.ts` | Remove `otpSchema`, `OTPSchema`, `OTPData` exports |
| D | **#080** | `views/otp-view.tsx` | Apply `id={otpInputId}` to `InputOTP` component or remove the prop |
| E | **#076 + #081** | `packages/convex/convex/email.ts` | Narrow `type` to union of literals + add `returns: v.null()` to all 3 actions |

**Quality Gate**: `pnpm build --filter=@feel-good/mirror && pnpm lint --filter=@feel-good/mirror`

### Phase 2: Sequential `use-otp-auth.ts` Refactors (Single agent, strict order)

All 5 todos modify the same file. Must be sequential to avoid merge conflicts and preserve semantic correctness.

| Step | Todo | Lines | Change |
|------|------|-------|--------|
| 1 | **#078** | 84-91, 117-124, 142-149 | Extract shared `handleAuthError` callback from 3 identical error blocks |
| 2 | **#074** | 56-69, 130-159 | Add `resendCooldownRef`, fix effect to use boolean dep `[resendCooldown > 0]`, remove `resendCooldown` from `resendOTP` deps |
| 3 | **#073** | 133-138 | Add `statusRef.current = "loading"` + `setStatus("loading")` at top of `resendOTP` (currently missing, creating race condition) |
| 4 | **#075** | ~140 | Move `setResendCooldown(60)` from before API call to inside `onSuccess`. Add `setResendCooldown(0)` to error handler |
| 5 | **#077** | 110-118, + Mirror app | Remove `window.location.href = callbackURL` from `verifyOTP`, delegate to `onSuccess` callback. Update Mirror app sign-in/sign-up pages to handle redirect in `onSuccess` |

**Ordering rationale**:
- **#078 first**: Extracting the error handler reduces function body size, making all subsequent edits cleaner
- **#074 second**: Ref refactor changes dependency arrays — cleaner to do before adding more logic
- **#073 third**: Adds loading state to the now-cleaner `resendOTP`
- **#075 fourth**: Moves cooldown to success callback, building on the updated flow
- **#077 last**: Touches `verifyOTP` (not `resendOTP`), doing it last avoids line drift from prior edits

**After each step**: Re-read the file to get fresh line numbers. After all 5 steps: run quality gate.

**Quality Gate**: `pnpm build --filter=@feel-good/mirror && pnpm lint --filter=@feel-good/mirror`

### Phase 3: E2E Tests (Single agent)

| Agent | Todo | File(s) | Change |
|-------|------|---------|--------|
| F | **#082** | `apps/mirror/e2e/auth.spec.ts` | Unskip the 2 `test.skip` tests. Add Playwright `route.fulfill()` mocking for Better Auth API responses so tests don't require a running Convex backend |

**Quality Gate**: `pnpm build --filter=@feel-good/mirror` (E2E tests themselves require special setup)

### Skipped

| Todo | Reason |
|------|--------|
| **#021** | AuthProvider underutilized — deliberately SKIPPED per project decision. Awaiting future arch decision. |

## Technical Approach

### Agent Configuration

**Phase 1**: Use Claude Code `Task` tool to spawn 5 parallel `general-purpose` subagents, each with:
- Specific file paths to modify
- Exact acceptance criteria from the todo
- Instruction to NOT touch any other files
- Instruction to mark todo as completed when done

**Phase 2**: Single agent (main session) handles all 5 sequential edits to `use-otp-auth.ts`:
- Re-reads the file before each edit step
- Makes one focused change per step
- Verifies the change matches acceptance criteria

**Phase 3**: Single `general-purpose` subagent for E2E test work.

### Build Verification

```bash
# After Phase 1 and Phase 2:
pnpm build --filter=@feel-good/mirror   # Type checks features + mirror
pnpm lint --filter=@feel-good/mirror    # ESLint

# Note: @feel-good/features has no build script
# Note: @feel-good/convex has no build script (typecheck via npx convex typecheck)
```

### Todo Completion Workflow

After each todo is resolved:
1. Move `todos/NNN-pending-*.md` → `todos/completed/NNN-completed-*.md`
2. Update frontmatter `status: pending` → `status: completed`
3. Add work log entry with date and learnings

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Phase 1 agent modifies wrong file | Explicit file list in prompt, review changes before commit |
| Phase 2 edit breaks prior edit | Re-read file between each step, build gate after all |
| #077 breaks Mirror app navigation | Must update Mirror pages to handle redirect in `onSuccess` |
| #082 E2E tests flaky | Use API mocking, not live backend |
| #080 accessibility regression | If removing `otpInputId`, verify no label association is lost |

## Acceptance Criteria

### Functional Requirements
- [ ] All 11 pending todos resolved (excluding #021)
- [ ] `pnpm build` passes for all apps
- [ ] `pnpm lint` passes for all packages
- [ ] No TypeScript compilation errors
- [ ] OTP auth flow works end-to-end (manual verification)

### Quality Gates
- [ ] Build gate passes after Phase 1
- [ ] Build gate passes after Phase 2
- [ ] No regressions in existing (non-skipped) E2E tests
- [ ] Each completed todo has work log entry

## Dependencies & Prerequisites

All explicit todo dependencies are already completed:
- #068 (statusRef sync guard) — completed
- #069 (email actions → internalAction) — completed

No external dependencies required.

## Effort Estimate

| Phase | Todos | Estimated Complexity |
|-------|-------|---------------------|
| Phase 1 | 6 (parallel) | Small each, ~5 min total |
| Phase 2 | 5 (sequential) | Medium — careful refactoring |
| Phase 3 | 1 | Medium — E2E mocking setup |
| **Total** | **12** | **~30 min agent time** |

## References

### Internal
- `packages/features/auth/hooks/use-otp-auth.ts` — central file for Phase 2
- `packages/features/auth/types.ts` — error message mapping (#067)
- `packages/convex/convex/email.ts` — Convex validators (#076, #081)
- `docs/solutions/multi-agent-todo-orchestration.md` — orchestration research

### Patterns
- statusRef sync guard pattern (from todo #068)
- Cooldown ref pattern (proposed in todo #074)
- Error handler extraction (proposed in todo #078)

### Related
- PR #104 — source of all these code review todos
- Branch: `mirror/020526-convex_auth`
