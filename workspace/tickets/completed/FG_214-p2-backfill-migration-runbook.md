---
id: FG_214
title: "Document backfillConversationMode invocation sequence and completion gate"
date: 2026-05-13
type: docs
status: completed
priority: p2
description: "backfillConversationMode has no documented runbook. The only reference to it in the codebase is the migration file itself. Without a documented invocation sequence and completion criterion, the narrow-phase PR (that removes v.optional from mode) can land prematurely and break Convex schema validation on un-backfilled rows."
dependencies:
  - FG_207
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "packages/convex/convex/migrations/chat.ts has a header comment describing the dry-run-then-real-run invocation sequence"
  - "The header documents the completion criterion (after FG_207: isDone === true; otherwise scanned < limit && patched === 0)"
  - "The header documents the narrow-phase prerequisite: backfill must complete on every deployment before the schema's mode field is made non-optional"
  - "grep -n 'backfillConversationMode' workspace/ returns at least one reference outside the migration file itself (in worktrees.md or a runbook)"
owner_agent: "Convex migrations engineer"
---

# Document backfillConversationMode invocation sequence and completion gate

## Context

`packages/convex/convex/migrations/chat.ts` exposes `backfillConversationMode`. After PR #93 ships, every Convex deployment has a `conversations` table where the new `mode` field is `v.optional(chatModeValidator)` and existing rows have `mode === undefined`.

The data-integrity reviewer found that grepping for `backfillConversationMode` returns only the migration file itself. There is:

- No runbook describing the invocation sequence (dry-run → real → verify completion → only then ship the narrow-phase PR)
- No cron schedule
- No completion check anywhere in the codebase
- No CI guard preventing the narrow phase from landing before backfill completes

The narrow-phase PR (a future PR that changes `mode: v.optional(chatModeValidator)` to `mode: chatModeValidator`) will fail Convex schema validation on every un-backfilled row. The bug surfaces only after deploy.

## Goal

A new engineer (or the original author returning in 3 months) can run the backfill, verify completion, and confidently open the narrow-phase PR using only the documentation in the repository.

## Scope

- Header comment block in `packages/convex/convex/migrations/chat.ts` explaining:
  - Why the migration exists (widen-migrate-narrow for `mode`).
  - The exact CLI invocation (`pnpm --filter=@feel-good/convex exec convex run migrations/chat:backfillConversationMode '{"dryRun": false}'` or similar).
  - The completion criterion (after FG_207 lands: loop until `isDone === true`; before FG_207: re-invoke until `scanned < limit && patched === 0`).
  - The narrow-phase prerequisite check (e.g., `convex run migrations/chat:backfillConversationMode '{"dryRun": true}'` must return `patched: 0`).
- Optional: a brief mention in `.claude/rules/worktrees.md` or a dedicated `workspace/runbooks/` entry if the project has one.

## Out of Scope

- The narrow-phase PR itself.
- Adding the cursor support (covered in FG_207; this ticket assumes FG_207 has landed before the runbook is finalized).
- Building a CI guard that blocks the narrow PR until backfill is verified.

## Approach

Write a header block at the top of the migration file describing:

1. Purpose (widen-migrate-narrow for `mode`).
2. Invocation: how to run dry-run, then real-run, in a loop.
3. Completion check: when to consider the migration "done."
4. Prerequisite gate before the narrow PR: a one-line `convex run ... '{"dryRun": true}'` invocation that should return `patched: 0`.

Cross-link this from the project's runbook directory if one exists, or from `.claude/rules/worktrees.md` if not.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Confirm FG_207 has landed (cursor support) OR write the comment for both states (with-cursor and without-cursor invocation sequences).
2. Add the header block to `packages/convex/convex/migrations/chat.ts`.
3. Search the repo for an existing runbook convention (`workspace/runbooks/`, `.claude/rules/worktrees.md`, etc.). If one exists, add a one-line pointer.
4. Read back to confirm the runbook is discoverable via grep on `backfillConversationMode`.

## Constraints

- Documentation only — no code change.
- Must not duplicate content between the migration file and the runbook entry; the runbook should reference the migration file as the source of truth.

## Resources

- PR #93 data-integrity review: `migration-no-runbook-or-invocation-doc`
- `.claude/rules/convex.md` — migration patterns
- Existing migration files (search `packages/convex/convex/migrations/`) for header-comment precedent
