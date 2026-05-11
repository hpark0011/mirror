---
id: PLAN_011
slug: graphify-effectiveness-measurement
title: "Measure Graphify effectiveness and feed improvements back into agent rules"
date: 2026-05-10
type: chore
status: active
branch: codex/graphify-effectiveness-measurement
worktree: null
scope: "Add a repeatable session-log measurement loop that tracks whether Graphify reduces exploration cost without lowering verification quality, then recommends upstream instruction patches."
apps: []
verification_tier: 1
---
## 1. Summary

Set up a closed feedback loop for Graphify adoption:

1. Parse recent Codex JSONL session logs.
2. Identify sessions where Graphify should have helped.
3. Measure graph-native usage, exploration cost, time to first edit, graph freshness, graph hygiene, and verification quality.
4. Emit a short report with baseline/current/target deltas.
5. Recommend exactly one upstream system patch when metrics miss target.
6. Run the report on a weekly automation so each shipping cycle improves the next one.

The goal is not "more Graphify usage" by itself. The goal is objectively lower pre-edit exploration cost while preserving or improving verification quality.

## 2. Objective Metrics

Primary outcome metric:

- **Median exploratory reads before first edit** for eligible implementation sessions.

Secondary metrics:

| Metric | Baseline | Target |
| --- | --- | --- |
| Graph-native adoption | 0% of eligible sessions | &gt;=70% |
| Median reads before first edit | 37 | &lt;=18 |
| Median time to first edit | 246s | &lt;=120s |
| Graph update compliance after code edits | TBD by analyzer | &gt;=90% |
| Verified edit rate | 29% | &gt;=80%, and never lower than baseline |
| Graph hygiene | stale + absolute paths found | `Built from commit == HEAD`, zero `/Users/...` paths |

Definitions:

- **Eligible session**: a session in this repo that either asks an architecture, cross-module, review, debugging, or implementation question, or touches more than one top-level area (`apps/`, `packages/`, `.claude/`, `scripts/`, `workspace/`).
- **Graph-native usage**: at least one successful `graphify query`, `graphify path`, or `graphify explain` before broad source spelunking.
- **Broad source spelunking**: six or more raw read/search commands before the first edit (`rg`, `sed`, `cat`, `nl`, `ls`, `find`, `git show`, `git diff`, `jq`, etc.).
- **Exploratory reads before first edit**: count of read/search commands before the first `apply_patch` or shell write.

## 3. Current State

- The existing retro analyzer lives under `${CODEX_HOME:-$HOME/.codex}/skills/retro/scripts/analyze_sessions.py` and already reports `median_read_calls_before_first_edit`, `median_time_to_first_edit_seconds`, `verified_edit_rate`, and `tests_not_run_rate`.
- `AGENTS.md` now requires graph-native commands before broad grep/file reads for cross-module relationship questions.
- `graphify-out/GRAPH_REPORT.md` is current when its "Built from commit" matches `git rev-parse HEAD`.
- `graphify-out/graph.json` was clean rebuilt from this worktree and has zero absolute `/Users/...` source paths.
- `graphify hook status` reports `post-commit` and `post-checkout` installed after setting `core.hooksPath` to the common git hooks directory.

## 4. Implementation Steps

### Step 1 — Add a Project Analyzer Script

Create `scripts/measure-graphify-effectiveness.mjs`.

Responsibilities:

- Read Codex logs from `${CODEX_HOME:-$HOME/.codex}/sessions` plus `${CODEX_HOME:-$HOME/.codex}/archived_sessions`.
- Accept flags:
  - `--days 14`
  - `--format text|json|markdown|html`
  - `--out <path>`
  - `--repo <path>` defaulting to `process.cwd()`
- Resolve this repo's sessions using turn-context `cwd`, injected `AGENTS.md`, or worktree paths containing `/mirror` or `/feel-good`.
- Count:
  - eligible sessions
  - sessions using `graphify query/path/explain`
  - graph-native commands before first broad read burst
  - read/search commands before first edit
  - seconds to first edit
  - edit sessions with `graphify update .` after edits
  - validation commands after final edit
  - failed validation repair closure
  - final answers that say tests were not run
- Inspect current graph hygiene:
  - `GRAPH_REPORT.md` "Built from commit" versus `git rev-parse HEAD`
  - any `/Users/` source path in `graphify-out/graph.json`
  - `graphify hook status`

The script should print a compact text report by default and support JSON for automation.

### Step 2 — Add Unit Coverage for Log Parsing

Create fixtures under `scripts/__fixtures__/graphify-effectiveness/` with tiny JSONL sessions:

- eligible session that uses `graphify query` before reads
- eligible session that does broad reads without Graphify
- code-edit session that runs `graphify update .`
- code-edit session missing graph update
- verified edit session
- edit session with tests-not-run final answer

Add a focused Vitest test, either:

- `scripts/measure-graphify-effectiveness.test.mjs`, if root tooling already supports it; or
- `apps/mirror/features/devtools/__tests__/graphify-effectiveness.test.ts`, if reusing the existing Mirror Vitest runner is lower friction.

Prefer keeping the analyzer plain Node with dependency-free parsing.

### Step 3 — Add a Stable HTML Report Output

When called with:

```bash
node scripts/measure-graphify-effectiveness.mjs --days 14 --format html --out workspace/reports/graphify-effectiveness/latest.html
```

the script should generate a static HTML report with:

- metric table
- current versus target status
- recommended patch section
- graph hygiene section
- "last analyzed" timestamp

Keep the HTML plain and deterministic enough for Playwright assertions.

### Step 4 — Add Playwright CLI Verification

Add a tiny Playwright spec:

`apps/mirror/e2e/graphify-effectiveness-report.spec.ts`

Assertions:

- generate a temporary HTML report and open it through a `file://` URL
- assert visible headings:
  - `Graphify Effectiveness`
  - `Median reads before first edit`
  - `Graph-native adoption`
  - `Recommended patch`
- assert the report does not contain `NaN`, `undefined`, or `Infinity`
- assert at least one metric row has a status of `pass`, `warn`, or `fail`

Run with:

```bash
pnpm --filter=@feel-good/mirror test:e2e -- graphify-effectiveness-report.spec.ts
```

### Step 5 — Add the Weekly Automation

Create a weekly Codex cron automation named `Graphify Effectiveness Retro`.

Schedule:

- weekly, Monday morning in the user's locale

Prompt:

- run the analyzer for the last 14 days
- include the compact metrics table
- call out the single weakest metric
- recommend one upstream patch to `AGENTS.md`, the retro skill, or the work skill
- do not modify files unless explicitly asked

This keeps the loop advisory by default. The human decides when to apply the patch, which avoids unattended instruction churn.

### Step 6 — Add a Manual Command Note

Add a short section to `AGENTS.md` or a new `.claude/rules/dev-process.md`subsection:

```bash
node scripts/measure-graphify-effectiveness.mjs --days 14
node scripts/measure-graphify-effectiveness.mjs --days 14 --format html --out workspace/reports/graphify-effectiveness/latest.html
```

Keep it terse. The main Graphify behavior rule already lives in `AGENTS.md`; this addition is only the measurement command.

### Step 7 — Baseline and First Report

Run:

```bash
node scripts/measure-graphify-effectiveness.mjs --days 14 --format json
node scripts/measure-graphify-effectiveness.mjs --days 14 --format html --out workspace/reports/graphify-effectiveness/latest.html
pnpm --filter=@feel-good/mirror test:e2e -- graphify-effectiveness-report.spec.ts
```

Generate the first baseline under `workspace/reports/graphify-effectiveness/`.
The `latest.*` files are local generated artifacts, not tracked snapshots,
because their graph freshness fields refer to the commit that was current at
generation time.

## 5. Recommendation Engine

The analyzer should recommend exactly one patch, using this priority order:

1. **Graph hygiene fail**: if graph is stale or contains `/Users/`, recommend a clean rebuild and hook check.
2. **Low graph-native adoption**: if eligible adoption is below 70%, recommend tightening `AGENTS.md` or the primary work skill to run `graphify query`before the sixth broad read.
3. **High reads before edit**: if median reads before first edit is above 18, recommend an exploration budget rule.
4. **Slow time to first edit**: if median time to first edit is above 120s, recommend a "graph query -&gt; file shortlist -&gt; first reversible edit" workflow.
5. **Low verified edit rate**: if verification is below 80%, recommend tightening `.claude/rules/verification.md` or the retro final-answer rule.
6. **Low update compliance**: if post-edit `graphify update .` is below 90%, recommend a hook/setup patch.

## 6. Constraints and Non-Goals

- Do not send private session contents to an external service.
- Do not quote user prompts or assistant answers in the report by default.
- Do not auto-edit `AGENTS.md` from the weekly automation.
- Do not require the Graphify graph to be perfect; source verification remains mandatory after graph traversal.
- Do not replace the existing retro analyzer. Reuse its concepts and, if practical, share small parsing helpers later.

## 7. Hard Verification

Required checks before calling this complete:

```bash
node scripts/measure-graphify-effectiveness.mjs --days 14 --format json
node scripts/measure-graphify-effectiveness.mjs --days 14 --format html --out workspace/reports/graphify-effectiveness/latest.html
pnpm --filter=@feel-good/mirror test:e2e -- graphify-effectiveness-report.spec.ts
git diff --check
```

Expected assertions:

- JSON output contains numeric `eligibleSessions`, `graphNativeAdoptionRate`, `medianReadsBeforeFirstEdit`, `medianTimeToFirstEditSeconds`, `verifiedEditRate`, and `graphUpdateComplianceRate`.
- HTML output renders all metric labels and no `NaN`, `undefined`, or `Infinity`.
- Playwright opens the generated report via `file://` and validates the visible metric table.
- `rg '/Users/' graphify-out/graph.json` returns no matches.

## 8. Rollout

1. Land the analyzer and tests.
2. Run it manually for the first baseline.
3. Create the weekly automation.
4. After two weekly reports, compare trend lines:
   - if adoption rises but reads do not fall, improve query examples
   - if reads fall but verification falls too, tighten verification before celebrating speed
   - if graph hygiene fails more than once, patch worktree setup instead of relying on humans to remember the clean rebuild ritual
