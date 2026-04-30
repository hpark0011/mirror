---
name: resolving-tickets
argument-hint: "[ticket-id like FG_069, or empty to pick the next by priority]"
description: "Resolves issue tickets from workspace/tickets/to-do/ by orchestrating an executor agent and a separate verifier agent with a feedback loop. Runs the ticket's acceptance_criteria as hard gates, then sets status to completed and moves the file to workspace/tickets/completed/. Use when the user says 'resolve tickets', 'clear tickets', 'work through tickets', 'process the ticket backlog', or hands off a specific FG_NNN ticket. Downstream of generate-issue-tickets. Does NOT create tickets (use generate-issue-tickets), does NOT author specs (use create-spec), and does NOT run spec-driven waves (use orchestrate-implementation)."
---

## Quick start

```
1. ls workspace/tickets/to-do/ — pick the next ticket (argument ID wins, else highest priority).
2. Read the ticket. Confirm dependencies are in workspace/tickets/completed/.
3. Spawn ONE executor agent (prompt: agents/executor.md) with the ticket path.
4. Spawn ONE verifier agent (prompt: agents/verifier.md) with the ticket path + executor's diff.
5. If verifier returns FAIL → SendMessage the failures to the executor's same thread; loop.
6. On PASS → set status: completed in frontmatter, git mv file to workspace/tickets/completed/.
7. Report: ticket ID, commands that proved each acceptance criterion, final file path.
```

## Scope & non-goals

**Use this skill when**:
- Tickets exist in `workspace/tickets/to-do/` with valid frontmatter (id, status, acceptance_criteria).
- The user wants work executed against those tickets and verified against their acceptance_criteria.
- Scope per ticket is bounded by the ticket's own Scope/Out of Scope sections.

**Do NOT use this skill for**:
- **Creating tickets** — that's `generate-issue-tickets`. This skill consumes its output.
- **Spec-driven multi-wave implementations** — if work lives in `workspace/spec/{feature}-spec.md` with a Team Orchestration Plan, use `orchestrate-implementation`. This skill is for the single-ticket granularity.
- **Free-text feature builds with no spec or ticket** — use `agent-orchestration`.
- **Single-file fixes with no ticket** — just edit the file. Agent-spawn overhead is ~10-20k tokens; not worth it.
- **Batch-resolving PR review comments** — that's `review-pr` / `compound-engineering:todo-resolve`. Tickets here are `workspace/tickets/*.md` files with frontmatter contracts, not review-thread todos.

## Workflow

### Phase 1 — Ticket selection

Run `ls workspace/tickets/to-do/`. Resolution order:

1. If the user passed an ID (e.g. `FG_069`), select that file.
2. Else pick the highest priority (`p0 > p1 > p2 > p3`); break ties by lowest ID.
3. Read the selected ticket. Check `dependencies:` — every dep must be a file in `workspace/tickets/completed/`. If not, STOP and report which deps are unmet. Do not silently skip.

Batch mode: if the user says "resolve all" or "work through the backlog", resolve tickets one at a time in priority order. **Never run two executors in parallel on the same repo** — they collide on shared files and mid-build state.

### Phase 2 — Executor dispatch

Spawn ONE executor subagent using [agents/executor.md](agents/executor.md) as the prompt body. Preferred `subagent_type`:

- If the ticket's `owner_agent` names a real registered agent in `.Codex/agents/` (rare — the field is usually a descriptive label), use it.
- Otherwise use `general-purpose`.

Pass the absolute ticket path. Do NOT paste the ticket body into the prompt — the executor will read it. The executor's job:

1. Read the ticket end-to-end (Context, Goal, Scope, Out of Scope, Approach, Implementation Steps, Constraints, **acceptance_criteria**).
2. Implement the change.
3. Run the acceptance_criteria commands itself as a self-check.
4. Report: per-file diff summary, per-criterion self-check output, any deviations.

The executor is explicitly **forbidden from self-approving** — even if its self-checks pass, the verifier (Phase 3) is the only pass signal. This separation is the whole point of the skill.

### Phase 3 — Verifier dispatch

Spawn ONE verifier subagent using [agents/verifier.md](agents/verifier.md) as the prompt body. Use `subagent_type: general-purpose`.

The verifier gets: the ticket path and the executor's reported diff summary. It does NOT modify files. It:

1. Reads the ticket's `acceptance_criteria` list.
2. Runs each criterion's command (grep, build, lint, wc -l, test) in its own shell.
3. Returns a structured report: per criterion → PASS / FAIL / INCONCLUSIVE + the actual command output evidence.
4. Does NOT trust the executor's self-check output. Runs independently.

A criterion is PASS only if the verifier's own command output matches the criterion's expectation. "The executor said it passes" is not evidence.

### Phase 4 — Feedback loop

If any criterion returns FAIL or INCONCLUSIVE:

1. Consolidate failures into a single concrete message: criterion number, expected output, actual output, file paths if relevant.
2. **SendMessage to the executor's existing thread** (do not spawn a new `Agent` — a fresh spawn re-loads 100k+ tokens and loses the already-loaded ticket + codebase context).
3. Ask the executor to resolve specifically those failures, then re-report its self-check.
4. Re-spawn the verifier on the new diff — a fresh verifier context is correct here because its job is to be independent of the executor.
5. Repeat until all criteria PASS or the loop exceeds 3 iterations. On iteration 3+, STOP and surface the persistent failures to the user rather than spinning further.

Never declare a ticket resolved with any FAIL criterion outstanding. INCONCLUSIVE (e.g. criterion command itself is malformed) gets surfaced to the user, not silently skipped.

### Phase 5 — Promotion to completed

When every criterion is PASS:

1. Edit the ticket's frontmatter: `status: to-do` → `status: completed`.
2. `git mv workspace/tickets/to-do/<file>.md workspace/tickets/completed/<file>.md` (filename unchanged).
3. Re-read the moved file — the validator hook will fire on the Edit; confirm it exits 0.
4. Commit per ticket: `git add` the moved ticket + code changes with an explicit file list (never `git add -A`). Commit message references the ticket ID (e.g. `refactor(chat): split use-chat hook — FG_069`).

One ticket = one commit = one rollback point. Do not batch multiple tickets into one commit even in batch mode.

### Phase 6 — Report

Per ticket, surface:
- Ticket ID + title
- Per-criterion PASS output (1 line each — command + key evidence)
- Files changed count
- Commit SHA
- Final path (`workspace/tickets/completed/FG_NNN-...md`)

In batch mode, add a summary table at the end: ID | result | iterations | SHA.

## Examples

### ✓ Good orchestration

```
User: resolve FG_069

Phase 1: Read FG_069-p1-split-use-chat-hook.md. Deps: []. Proceed.
Phase 2: Spawn executor (general-purpose) with ticket path.
         Executor reads ticket, splits use-chat.ts into 3 hooks, runs self-check.
         Self-check: wc -l returns 148 ✓, grep useState count 2 ✓, pnpm build exits 0 ✓.
Phase 3: Spawn verifier (general-purpose, fresh context) with ticket path + diff.
         Verifier runs every acceptance_criteria command itself.
         Result: all 7 criteria PASS.
Phase 5: Edit frontmatter status → completed. git mv to completed/. Commit.
Phase 6: FG_069 ✓ — 1 iteration, 4 files, SHA a1b2c3d.
```

### ✗ Bad orchestration (anti-patterns in one run)

```
User: resolve FG_069

Skipped dep check → started a ticket whose deps were still in to-do/.
Pasted full ticket body into executor prompt (+2k tokens, redundant).
Executor ran self-check and orchestrator marked ticket completed based on executor's word.
Two tickets resolved in parallel — second executor's pnpm build raced the first.
All 3 reviewers from orchestrate-implementation spawned on a 2-line refactor fix (-100k tokens).
Used Agent instead of SendMessage for feedback round 2 — lost warm context.
Committed 3 tickets' code in one squash with a generic "resolve tickets" message.
```

## Anti-patterns

- **Executor self-approves.** If the executor's own self-check is the only signal, there is no verification separation. Always dispatch the verifier — its independence is the only thing this skill adds over ad-hoc resolution.
- **Verifier reads executor's claimed output instead of running commands.** The verifier must run each acceptance criterion itself. Trusting the executor's self-report collapses the two roles.
- **Spawning a fresh `Agent` for the feedback loop.** Use `SendMessage` to the executor's existing thread — it has the ticket, codebase, and prior diff already loaded. A new spawn costs 100k+ tokens and often re-litigates decisions.
- **Resolving multiple tickets in parallel.** Shared files + concurrent `pnpm build` = flaky verification. Sequential in batch mode.
- **Skipping the dependency check.** A ticket with unmet deps will fail acceptance_criteria in surprising ways. Surface the gap, don't race into it.
- **Updating `status: completed` without moving the file** (or vice versa). The two-place status rule from `generate-issue-tickets` applies here too — they must stay in sync.
- **Batching ticket commits.** One ticket = one commit. Rollback becomes ugly otherwise.
- **Adding non-ticket-scope changes to the executor's work.** Out of Scope in the ticket is binding. If the executor proposes surrounding cleanup, reject it and let the user file a follow-up ticket via `generate-issue-tickets`.
- **Iterating past 3 verifier rounds.** If the loop hasn't converged, the ticket's acceptance_criteria or scope is wrong. Surface to the user — don't keep burning tokens.
- **Mid-loop clarifying questions to the user.** Front-load any ambiguity at Phase 1 before spawning agents.

## References

- [agents/executor.md](agents/executor.md) — executor prompt body.
- [agents/verifier.md](agents/verifier.md) — verifier prompt body.
- `.Codex/skills/generate-issue-tickets/SKILL.md` — upstream half: ticket schema and the two-place status rule this skill upholds.
- `.Codex/skills/orchestrate-implementation/SKILL.md` — larger-scope cousin for spec-driven waves; the executor/verifier/SendMessage patterns here are adapted from it.
- `.Codex/rules/verification.md` — build/lint/Chrome-MCP tier the verifier picks from when the ticket's acceptance_criteria are under-specified.
