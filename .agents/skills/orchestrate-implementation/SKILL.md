---
name: orchestrate-implementation
argument-hint: "<spec-path>"
description: "Executes a finished spec from workspace/spec/ by running its Team Orchestration Plan with disciplined wave execution — orchestrator/executor/verifier separation, parallel critique, feedback loops to green. Use when the user says 'implement this spec', 'run the orchestration plan', 'execute the spec', 'orchestrate the implementation', or hands you a spec file with intent to build it. The downstream half of the create-spec → orchestrate-implementation pipeline. Does NOT author specs (use create-spec) and does NOT do single-file fixes (just edit them directly)."
---

# Orchestrate Implementation Skill

Runs the Team Orchestration Plan from a finished spec. The skill enforces three things the ad-hoc version doesn't: a sharp orchestrator/executor/verifier separation, a feedback loop that runs until verifiers return clean, and budget discipline that prevents the "spawn another agent for everything" trap.

The architecture is sound. The cost is in execution efficiency. Every rule in this skill was earned by burning tokens the hard way.

## Scope & non-goals

**Use this skill when**:
- You have a spec at `workspace/spec/{feature}-spec.md` whose Team Orchestration Plan you want to execute.
- The work spans multiple files, multiple agents, and multiple verification gates.
- The user wants implementation, not authoring.

**Do NOT use this skill for**:
- **Authoring the spec itself** — that's `create-spec`. This skill consumes its output.
- **Single-file edits or one-shot bug fixes** — just edit the file. Agent-spawn overhead is ~10-20k tokens minimum; not worth it for a 10-line change.
- **Pure research or exploration** — use `Explore` directly or skill-specific research agents.
- **Re-authoring waves on the fly** — if the spec is wrong, fix it in `create-spec` first, then come back.

**Sibling skill — when to prefer it**:
- `.claude/skills/agent-orchestration/SKILL.md` — for **free-text requirements without a spec**. It has its own Explorer + Planner phase to figure out what to build. Use it when the user says "build X" without prior spec authoring. This skill is for the spec-driven case where create-spec already produced the plan. If you don't know which to use: do you have a `workspace/spec/{feature}-spec.md`? Yes → this skill. No → either run create-spec first, or use `agent-orchestration`.

## Quick start

```
1. Read the spec at workspace/spec/{feature}-spec.md in full.
2. Plan waves: each wave = one set of changes that pass one set of verification gates.
3. For each wave: spawn ONE executor → spawn 1-2 verifiers in parallel on the diff → consolidate findings → feedback loop until clean → commit.
4. Do not spawn agents for investigations resolvable in <5 file reads.
5. Do not re-spawn verifiers for deterministic <3-file fixes — spot-check the diff yourself.
```

## Workflow

### Phase 1 — Plan waves (orchestrator only)

Read the spec end-to-end. The spec's Team Orchestration Plan lists logical steps with suggested executors, hard gates, and verified FRs — but it does NOT pre-assign reviewers. Your job here is to **regroup those steps into waves** (a wave bundles steps that share a gate) and, in Phase 3c, pick reviewers from the critique routing table below. That table is the single source of truth for the `code-review-*` roster; the spec template intentionally does not duplicate it.

Plan waves before spawning anything.

**Wave scoping rule**: a wave is *one set of changes that pass one set of gates*. Not one file. Not one agent. One verification gate.

Examples:
- Wave 0 = test runner setup → gate: existing tests still green
- Wave 1 = backend implementation → gate: backend tests + typecheck
- Wave 2 = frontend + e2e → gate: app build + e2e green

State the wave plan in 5-10 lines and present it to the user for confirmation BEFORE spawning agents. Confirmation is cheap; misaligned waves are expensive.

### Phase 2 — Front-load clarifying questions

Collect ALL ambiguous decisions (config values, API choices, scope boundaries) in a single batch and ask the user once. Iterative clarification mid-implementation is a token tax — every clarification round invalidates prior agent context.

If the spec already answers a question, do not re-ask. Read the spec first.

### Phase 3 — Wave execution loop

For each wave:

#### 3a. Executor dispatch

Spawn ONE executor agent per wave. Do NOT split a wave across parallel executors — they collide on shared files and force `convex codegen` re-runs.

**Executor prompt template** (target ≤800 tokens):
- **What's done**: prior waves' state in 1-2 lines.
- **Scope**: file list (paths), what to change, what to read.
- **Forbidden**: explicit list of files/areas that must not be touched.
- **Hard verification gates**: exact shell commands the executor must run before reporting done. Include exit-code expectations.
- **Escape hatch**: "If you spend >5 turns on one sub-problem (mock setup, config wiring, dependency resolution), STOP and report the exact error rather than chasing it. The orchestrator will simplify or hand off."
- **Reporting format**: per-file diff summary, exit codes, deviations.

Trust the executor to read the spec. Do NOT restate FRs, NFRs, or design rationale in the prompt — that's spec content, the agent will read it. The prompt is scope + gates + escape hatches, nothing else.

#### 3b. Direct-read rule (the most-violated rule)

**Do NOT spawn an agent for any investigation that resolves in <5 file reads.** Read the files yourself with `Read`/`Grep`. The spawn overhead exceeds the value.

Reserve agents for:
- Genuinely parallel work (3+ independent reviewers on the same diff)
- Deep multi-file research (10+ files, multiple search strategies)
- Work that needs an isolated context window (executors writing code, verifiers running tests)

Trust direct reads over a subagent's summary for any small, verifiable claim. *"Test runner: Bun"* from a subagent is a claim, not a fact. Verify by reading `package.json` scripts yourself.

#### 3c. Verifier dispatch (with budget discipline)

After the executor returns a diff, spawn verifiers on the diff. Critique agents come from `.claude/agents/code-review-*`. **Pick the minimum** needed. This table is the canonical reviewer roster — the spec template intentionally does not duplicate it, so this is the only place in the pipeline where reviewer selection is decided.

**Critique-minimization rule**:
- Default 1-2 reviewers per wave. Add a 3rd only when the work spans correctness AND a specialist axis (concurrency, security, data-integrity).
- Never add a reviewer "for completeness."
- For features whose threat model IS the spec (rate limiting, auth flows, input validation), fold security into correctness — do not dispatch a separate `code-review-security` agent. The reviewer will return clean findings on 30-50k tokens because the threat model is already in the FR table.

| Work type | Default critique (pick 1-2) |
| --- | --- |
| Backend logic, mutations, state machines | `code-review-correctness` + `code-review-tests` |
| Schema / migrations / Convex validators | `code-review-data-integrity` |
| Auth/permissions/input boundaries WHEN the threat model is NOT the spec | `code-review-security` |
| Streaming, locks, retries, cancellation | `code-review-concurrency` |
| File organization, naming, public API contract | `code-review-convention` |
| Hot paths, large lists, Convex reads | `code-review-performance` |

Run verifiers in parallel — single message, multiple `Agent` tool uses. Each verifier gets a self-contained prompt referencing the diff (not pasting it).

#### 3d. Feedback loop (the load-bearing piece)

When verifiers return:

1. **Consolidate findings by severity.** Critical/Important findings must be addressed; Minor findings are negotiable.
2. **Spot-check vs re-spawn rule** — decide reviewer dispatch by fix size:
   - **<3 files, deterministic fix** (add a slice, swap two lines, rename a variable): orchestrator spot-checks the diff directly with `git diff` and re-runs the hard gates. **No reviewer re-spawn.**
   - **New tests added or new logic written**: re-dispatch only the affected reviewer(s). Never all of them.
   - **Cross-cutting refactor**: full re-review.
   - Re-spawning all reviewers for a deterministic 2-line fix is the orchestration anti-pattern that costs 50k+ tokens for zero value.
3. **Send consolidated feedback to the executor in its same thread** via `SendMessage`. The thread context is already loaded — a fresh `Agent` spawn would re-load 100k+ tokens of context.
4. **Iterate until verifiers return clean OR all findings are explicitly accepted with rationale.** Never declare a wave done with unresolved Critical findings.

#### 3e. Commit per wave

Commit each wave as its own checkpoint before moving to the next. Use `git add` with explicit file paths (never `git add -A`). One wave = one commit = one rollback point. The eventual PR review is much easier when waves are isolated commits.

### Phase 4 — Final handoff

After the last wave's gates are green, summarize:
- Commits per wave with SHA
- Total tests pass count vs baseline
- Files changed count
- Outstanding follow-ups (anything explicitly deferred)

Do NOT push or open a PR unless the user explicitly asks. Wave commits are checkpoints, not ship signals.

## Examples

### ✓ Good orchestration (this skill in action)

```
Spec: workspace/spec/chat-constraints-spec.md (cap Anthropic API spend)

Wave 0 — test runner setup
  Executor: chat-backend-developer (Wave 0 prompt, 800 tokens, narrow scope)
  Verifier: code-review-tests (1 reviewer, NFR-07 semantic identity check)
  Outcome: 2 file imports migrated, vitest installed, 9 existing tests green
  Commit: 1 wave commit, 4 files

Wave 1 — backend implementation
  Executor: chat-backend-developer (Wave 1 prompt, scope + forbidden + gates)
  Verifiers: code-review-correctness + code-review-tests + code-review-concurrency
    (3 reviewers, in parallel, NO security review — feature IS security)
  Findings: 1 correctness + 5 critical test gaps
  Feedback loop: SendMessage to executor's same thread (no re-spawn)
  Re-verification: only correctness + tests reviewers (concurrency was clean)
  Commit: 1 wave commit, 10 files

Wave 2 — frontend + e2e
  Executor: general (small surface)
  Verifier: code-review-correctness (1 reviewer)
```

### ✗ Bad orchestration (what we did the hard way before this skill existed)

```
Spec: same.

Spawned codebase-analyst agent for a 4-file investigation (could have read directly): -20k tokens
Spawned 4 verifiers for Wave 1 including code-review-security on a security feature: -38k tokens
Re-spawned all 4 verifiers after a deterministic helpers.ts fix: -100k tokens
Wave 1 executor prompt was 3000 tokens of FR restatement: -2k tokens × 2 iterations
Wave 1 executor hit maxTurns ceiling twice (loose escape hatches): -50k tokens of debug spiral
Iterative clarifying questions across 4 user round-trips: -10k tokens of context churn

Total avoidable: ~250k tokens for the same outcome.
```

## Anti-patterns

- **Spawning agents for small investigations.** If `Read` + `Grep` resolves it in <5 calls, do that instead. Agent overhead is ~10-20k tokens minimum.
- **Trusting subagent summaries on infrastructure claims.** *"Test runner: Bun"* is a claim. Verify by reading `package.json` scripts.
- **Restating spec content in executor prompts.** The executor will read the spec. The prompt is scope + gates + escape hatches.
- **Adding verifiers "for completeness."** Every reviewer is 30-50k tokens. Pick the minimum.
- **Dispatching `code-review-security` on a security feature.** The threat model is already in the FR table; the correctness reviewer will catch the same issues.
- **Re-spawning all reviewers for a deterministic fix.** Spot-check the diff yourself. Re-dispatch only the affected reviewer when new logic is added.
- **`Agent` instead of `SendMessage` for feedback loops.** A fresh `Agent` re-loads 100k+ tokens of context. `SendMessage` keeps the executor's thread warm.
- **Iterative clarifying questions across multiple user round-trips.** Front-load all questions in a single batch before spawning anything.
- **No escape hatch in executor prompts.** Without "stop after 5 turns of struggle," executors burn 40+ tool uses on `vi.mock` race conditions.
- **Wave splits by file ownership instead of verification gates.** A wave is one set of changes that pass one set of gates.
- **Committing all waves at the end.** Commit per wave for clean rollback points and easier eventual PR review.
- **Skipping the front-load clarification phase.** Every mid-wave clarification round invalidates prior agent context.

## References

- `.claude/skills/create-spec/SKILL.md` — the upstream half of the pipeline. Produces the spec this skill consumes.
- `.claude/agents/code-review-*.md` — the verifier roster.
- https://www.anthropic.com/engineering/harness-design-long-running-apps — rationale for executor/verifier separation.
