---
name: resolve-issue-tickets
description: Resolves issue tickets in workspace/tickets/to-do/ in parallel waves. Reads every ticket up front, plans a dependency- and file-collision-safe wave schedule, then dispatches executor+verifier agents per ticket inside each wave with a feedback loop. Marks each resolved ticket `status: completed` and moves the file to workspace/tickets/completed/. Use when the user says "resolve tickets", "work through tickets", "/resolve-issue-tickets". Does NOT create tickets (use generate-issue-tickets) or triage them (use triage-issue-tickets).
---

# Resolve Issue Tickets

Resolve all open tickets in `workspace/tickets/to-do/` by running them through executor → verifier with a feedback loop. Tickets that don't share files and don't depend on each other run **in parallel**. The orchestrator (you) plans the waves; an executor agent does the work; a separate verifier agent checks `acceptance_criteria`.

## Scope & non-goals

**In scope**: working through one or more tickets already present in `workspace/tickets/to-do/`.

**Out of scope**:
- Creating tickets → use `generate-issue-tickets`.
- Triaging the backlog (cancel / mark-already-solved) → use `triage-issue-tickets`.
- Authoring or executing a full feature spec → use `create-spec` / `orchestrate-implementation`.

## Workflow

### Phase 0 — Resume detection

A prior session may have already resolved some of these tickets and committed the code without managing to move every file (the FG_206 miss in PR #93 — code commits landed, ticket file never moved; or the beijing session where the orchestrator stopped mid-wave with code committed and tickets stranded). Before planning a fresh schedule, reconcile against history.

1. Run `git log --oneline -50 -- workspace/tickets/ packages/ apps/` and grep the commit subjects/bodies for `FG_[0-9]\{3\}` patterns. Build the set `ALREADY_LANDED` of ticket IDs referenced by commits on this branch since `main`.
2. For each ID in `ALREADY_LANDED` that is **also** in `to-do/`, read the ticket file and the referenced commit. If the commit's diff plausibly satisfies the ticket's `acceptance_criteria`, treat the ticket as a resume candidate; otherwise treat it as a normal to-do (the commit touched the area without resolving the ticket).
3. List resume candidates back to the user in one block before the wave plan:

   ```
   Resuming from previous session — 3 tickets appear already implemented in commits but the ticket files are still in to-do/:
     - FG_206 (commit 4596cf47) — verifier will confirm or reject
     - FG_213 (commit 4596cf47)
     - FG_217 (commit a1b2c3d4)
   Will run verifiers on these in Wave 0 before scheduling fresh work.
   ```

4. Wave 0 dispatches verifiers ONLY (no executors) for resume candidates. APPROVED → mark completed via `scripts/mark-completed.sh`. REJECTED → drop from `ALREADY_LANDED` and schedule normally.

Skip Phase 0 if `git log` returns no `FG_NNN` references on this branch. Skip if `to-do/` is empty (Phase 1 will exit anyway).

### Phase 1 — Scan all tickets

1. List every file in `workspace/tickets/to-do/`. If empty, stop and report.
2. Read each ticket and extract:
   - `id`, `priority`, `dependencies` (frontmatter)
   - `acceptance_criteria` (the verification list)
   - **Touched file paths** — parse from `## Scope`, `## Implementation Steps`, and any path-shaped strings in `acceptance_criteria` (`apps/...`, `packages/...`).
3. Build a ticket index: `{ id, file, deps, files_touched, acceptance_criteria }`. Exclude any ID promoted out of `to-do/` by Phase 0.

Do this with direct `Read`/`Bash(ls)` — do NOT spawn an agent for the scan.

### Phase 2 — Build wave plan

A **wave** is a set of tickets safe to run in parallel. Two tickets MUST NOT share a wave if either is true:

1. **Dependency edge** — one ticket lists the other (or a transitive ancestor) in `dependencies`.
2. **File collision** — both tickets touch the same file. Parallel writes silently clobber each other; the verifier will not catch it because each agent's gates pass in isolation.

Wave assignment algorithm (run mentally, not as code):

- Topologically sort by `dependencies`.
- Greedily pack each ticket into the earliest wave where (a) all its deps land in earlier waves and (b) no co-wave ticket overlaps its `files_touched`.
- Cap each wave at **4 parallel tickets** (harness throughput + reviewer cost).

Present the wave plan to the user as a compact table:

```
Wave 1 (3 tickets, parallel):
  - FG_125 [p1] slug-dirty-ref-default
  - FG_127 [p1] article-form-uses-rhf-zod
  - FG_133 [p2] restore-env-script-port
Wave 2 (2 tickets, parallel; FG_129 → FG_129-p2 dep):
  - FG_129 [p1] cover-image-orphan-cleanup
  - FG_131 [p2] cancel-uses-router-replace
Wave 3 (1 ticket; depends on FG_129):
  - FG_129-p2 [p2] dispatcher-href-override-unit-test
```

**Wait for user confirmation before spawning anything.** Misaligned waves are expensive to undo.

### Phase 3 — Direct-read shortcut (apply per ticket, before dispatch)

For any ticket where the fix is deterministic AND resolves in <5 file reads (e.g., one-line change, rename, prop default), do NOT spawn an executor. Edit it directly, run the gates from `acceptance_criteria`, set `status: completed`, move the file. The wave then runs the remaining non-trivial tickets in parallel.

A 30-ticket batch with 25 trivial fixes resolves the 25 inline and parallelizes the remaining 5. Spawn overhead (~10-20k tokens) is not worth paying for a one-line edit.

### Phase 4 — Per-wave execution

For each wave, in order:

#### 4a. Dispatch executors in parallel

Send a **single message with one `Agent` tool use per ticket** so executors run concurrently. Settings per executor:

- `subagent_type`: `general-purpose`
- `model`: `haiku` (escalate to `sonnet` if the ticket is `priority: p0` or touches Convex schemas / auth)
- `description`: `Resolve <ticket-id>`

**Payload discipline — this is the dominant token cost in this skill.** Past sessions burned ~6M cache_read tokens per ticket because the orchestrator's full review-code context, prior wave traces, and conversation history flowed into every executor spawn. Target ≤2M cache_read per ticket dispatch. The executor only needs three things:

1. The ticket file path — the executor reads it directly. Do **not** quote the ticket body.
2. The pointer to monorepo conventions (`AGENTS.md` at repo root) — one line, not the contents.
3. The forbidden-files list derived from co-wave tickets' `files_touched`.

Do not paste: review findings, prior wave outputs, the `<intent>` packet, lessons-file excerpts, or earlier executor diffs. Each of those costs the parent's full context window again when the harness caches the spawn.

Executor prompt template (target ≤800 tokens of input; if you find yourself exceeding 1.2k, you are leaking parent context):

```
Resolve ticket: workspace/tickets/to-do/<filename>.md

Read the ticket in full — title, Context, Scope, Implementation Steps,
Acceptance Criteria, Out of Scope. Monorepo conventions live in
AGENTS.md at the repo root.

Implement only what the ticket scopes. Do NOT touch files listed under
"Out of Scope" or files that belong to other tickets in this wave:
<list of forbidden files derived from co-wave tickets' files_touched>

When you believe you are done, run every shell command listed in the
ticket's acceptance_criteria and report exit codes. Do NOT mark the
ticket completed yourself — a separate verifier will do that.

Escape hatch: if you spend >5 turns on one sub-problem (mock setup,
config wiring, type errors you cannot resolve), STOP and report the
exact error rather than chasing it. The orchestrator will simplify.

Report back:
1. Per-file diff summary (paths + 1-line description per file)
2. Verification command outputs (pass/fail per acceptance_criterion)
3. Any deviations from the ticket's Implementation Steps and why
```

Do NOT restate the ticket body in the prompt — the executor will read it.

#### 4b. Dispatch verifiers (one per executor that returned)

After each executor returns its diff, spawn a verifier for that ticket. Verifiers can also run in parallel across the wave. Settings:

- `subagent_type`: `Explore`
- `model`: `sonnet`
- `description`: `Verify <ticket-id>`

Verifier prompt template:

```
Verify resolution of ticket: workspace/tickets/to-do/<filename>.md

Read the ticket's acceptance_criteria. For each criterion:
- If it names a shell command, run it and capture exit code + relevant output.
- If it names a file path or grep pattern, read/grep and confirm.
- If it asserts code behavior, read the affected file(s) and check.

Also check:
- No files outside ticket Scope were modified (use `git diff --name-only`).
- Out of Scope items were respected.

Return one of:
APPROVED: <one-line summary>
REJECTED: <bulleted list of failing criteria with file:line and the
exact gap; include the verification command output that failed>

Do NOT modify files. Verification only.
```

Executor and verifier MUST be different agents. The executor must not verify its own work.

#### 4c. Feedback loop (per ticket)

If a verifier returns `REJECTED`:

1. **Spot-check vs re-spawn**:
   - Fix is <3 files and deterministic (add a slice, swap two lines): orchestrator applies the fix directly with `Edit`, re-runs the failing acceptance commands, skips re-spawning the verifier.
   - Fix adds new logic or new tests: send the consolidated feedback to the **executor's existing thread via `SendMessage`** (do NOT spawn a fresh `Agent` — that re-loads 100k+ tokens). Re-dispatch the verifier on the new diff.
2. Max **2 feedback rounds per ticket**. After 2 failed rounds, leave the ticket in `to-do/`, append a `## Resolution Blockers` section to its body summarizing the unresolved findings, and surface it in the final report.

#### 4d. Mark resolved & move file

For each batch of tickets whose verifiers returned `APPROVED`, close them with the helper script — never the ad-hoc `for f in …; sed; mv` loop. Single command, all-or-nothing, validates that each file is actually in `to-do/` with `status: to-do` before touching anything:

```bash
.claude/skills/resolve-issue-tickets/scripts/mark-completed.sh FG_209 FG_213 FG_220
```

The script flips frontmatter `status: to-do` → `status: completed` and `git mv`s the file to `completed/`. If any input fails validation (wrong ID, file missing, status already changed), the script aborts and modifies nothing — that's the design. Past sessions dropped tickets because the ad-hoc loop quietly skipped one ID and the orchestrator didn't notice (FG_206 in PR #93). The script makes that impossible.

Then stage the moved files with the wave's commit (see 4e).

#### 4e. Commit per wave (optional)

If the user has asked to commit progress, commit each wave as one checkpoint. Use explicit file paths with `git add` (never `git add -A`). One wave = one commit = one rollback point.

### Phase 5 — Build gate (mandatory before "done")

Per-ticket verifiers prove each ticket's `acceptance_criteria` in isolation. They do not catch cross-ticket regressions or downstream build/deploy failures. PR #93's resolve session declared victory after all 18 verifiers approved — then spent 49 minutes recovering from a Vercel/Convex deploy break caused by the merged changes. Don't repeat that.

Before declaring tickets resolved, run on the final committed state:

1. The repo's full build: `pnpm build` (or whatever `package.json`'s build script is at the root). Exit 0 required.
2. The targeted typecheck for every affected app/package — derive the `--filter` list from `git diff --name-only main..HEAD`. Exit 0 required.
3. For any Convex-touching wave, additionally: `pnpm --filter=@feel-good/convex check-types` and `pnpm --filter=@feel-good/convex test`.

If any of those fail:

- The failure is a feedback round on the most recently committed wave — go back to 4c with the build output as the rejection signal.
- Do NOT file a new ticket for the build break. The break belongs to the wave that introduced it.
- Do NOT report tickets as resolved while the build is red. The `to-do/` queue may be empty but the work is not done.

Only after all three gates pass: proceed to Phase 6.

### Phase 6 — Final report

After the build gate passes, report:

- Tickets resolved / total (count includes Phase 0 resume candidates that verifiers approved)
- Tickets blocked (with the unresolved findings, surfaced from 4c)
- Per-ticket commit SHA if committed
- Any acceptance criteria explicitly accepted-with-rationale rather than passed
- Build-gate results (build ✓, typecheck ✓ per filter, Convex test ✓ if applicable)

## Parallelization safety rules

| Rule | Why |
| --- | --- |
| Detect file collisions BEFORE scheduling | Parallel writes to the same file silently clobber; per-agent gates still pass |
| Respect explicit `dependencies` and their transitive ancestors | A ticket's gates may rely on its deps' code being already merged |
| Cap each wave at 4 parallel tickets | Harness throughput + reviewer/executor token cost |
| One executor per ticket; do NOT split a ticket | The ticket is the atomic unit of scope |
| `SendMessage` for feedback, never fresh `Agent` | Fresh spawn re-loads 100k+ tokens of executor context |
| Spot-check ≤2-line fixes; do not re-spawn verifier | Re-spawn for a 2-line fix is the orchestration anti-pattern |
| Direct-read shortcut for trivial tickets | Spawn overhead exceeds value for <5-read fixes |

## Roles

| Role | Subagent type | Model | Responsibility |
| --- | --- | --- | --- |
| Orchestrator (you) | — | — | Scan tickets, plan waves, dispatch, mark completed, move files |
| Executor | `general-purpose` | `haiku` (or `sonnet` for p0/Convex/auth) | Read ticket, implement scope, run acceptance gates |
| Verifier | `Explore` | `sonnet` | Check acceptance_criteria, return APPROVED/REJECTED. Read-only. |

## Anti-patterns

- **Resolving tickets one-at-a-time when they're independent.** That's the previous version of this skill. Wave-parallel is the default now.
- **Skipping the wave plan and just spawning N executors.** File collisions are silent; the plan is what catches them.
- **Letting the executor verify itself.** The verifier exists because executors confirm their own success too readily.
- **Re-spawning the verifier after a 2-line fix.** Spot-check the diff, re-run gates, move on.
- **Spawning an executor for a one-line typo fix.** Edit it directly.
- **Closing tickets with an ad-hoc `for f in …; sed; mv` loop.** Use `scripts/mark-completed.sh`. The script's all-or-nothing validation is the only thing that has caught the "code committed, ticket file stranded in to-do/" failure mode (FG_206 in PR #93).
- **Pasting the orchestrator's context into the executor prompt.** The executor reads the ticket file; it does not need the review report, prior wave outputs, or the intent packet. Every extra paragraph multiplies the cache_read cost across every wave.
- **Reporting "all tickets resolved" before `pnpm build` exits 0 on the final commit.** Per-ticket verifiers don't catch cross-ticket regressions. Phase 5 is not optional.

## References

- `.claude/skills/orchestrate-implementation/SKILL.md` — same executor/verifier/feedback-loop pattern, applied to one spec instead of many tickets. Source of the budget rules this skill inherits.
- `.claude/skills/agent-orchestration/SKILL.md` — wave-based orchestration for free-text feature requirements.
- `.claude/skills/generate-issue-tickets/SKILL.md` — defines the ticket frontmatter contract this skill consumes.
- `.claude/skills/triage-issue-tickets/SKILL.md` — sibling skill for canceling/closing tickets without resolving them.
- `.claude/rules/dev-process.md` — solution-quality bar; "never mark complete without proving it works."
- `.claude/rules/verification.md` — the build/lint/Chrome-MCP tiers acceptance commands should match.
