---
name: review-code
argument-hint: "[path | branch | --staged]"
description: Reviews pending code changes in this monorepo against AGENTS.md and .claude/rules/, producing a prioritized findings report. Use when the user says "review this code", "code review", "review my changes", "check this before I commit", or asks for feedback on a diff, branch, or file. Distinct from review-pr (fetches GitHub PR comments) and security-review (threat-model focused).
---

# Reviewing Code

Senior-engineer code review tuned to this repo's conventions. A pipeline of judgment: understand intent, route to narrow reviewers, collect findings, compose only what matters.

**Core rule:** every finding must name a concrete failure mode or broken invariant. Style preferences without a risk story are dropped at validation (Phase 5).

## Stop conditions

Pause and surface instead of pressing on when:

- Working tree is clean and no arg given — ask what to review.
- The PR description contradicts the diff — surface the contradiction in the report; do not produce line-level findings on a misread goal.
- A reviewer sub-agent times out or errors — note it in the Coverage footer and proceed; don't block on a single specialist.

## Workflow

```
- [ ] 1. Ingest    — scope, changed files, untracked check, worktree-clean check, read each file fully, load matching rules
- [ ] 2. Intent    — infer change type, goal, expected behavior, invariants, risk surface; grep workspace/lessons.md for past incidents
- [ ] 3. Route     — pick reviewers based on the risk map (correctness/convention/tests/maintainability/agent-native always)
- [ ] 4. Review    — spawn selected reviewers AND run build+lint in parallel
- [ ] 5. Normalize — validate, confidence-gate (0.60 / P0@0.50), fingerprint dedup, agreement boost, disagreement preservation, pre-existing partition
- [ ] 6. Compose   — group by priority tier; render tables with Route column; pre-existing in its own section; format-verification self-check
- [ ] 7. Hand off  — render the handoff line that points the user at `/generate-issue-tickets` and `/resolve-issue-tickets`; the report IS the terminal output, do not apply fixes
```

**The skill terminates at the report.** The orchestrator does not file tickets, apply fixes, or run build/lint cycles after the report renders. Those belong to downstream skills (`/generate-issue-tickets`, `/resolve-issue-tickets`). Keeping the orchestrator out of the fix loop is the whole point of this skill's shape — otherwise the parallel-reviewer outputs plus an inline fix loop blow past context-compaction in a single session.

### Phase 1 — Ingest

Determine scope and build the review packet. Read files in full; context lives outside the hunks.

| Input          | Command                                                                                |
| -------------- | -------------------------------------------------------------------------------------- |
| No arg         | `git diff main...HEAD`                                                                 |
| `--staged`     | `git diff --staged`                                                                    |
| Branch name    | `git diff main...<branch>`                                                             |
| File or dir    | `git diff main -- <path>`                                                              |
| `--base <ref>` | `BASE=$(git merge-base HEAD <ref>) \|\| BASE=<ref>; git diff $BASE` — fast-path for skill-to-skill callers that already know the base. Skip merge-base detection. Do not combine with branch arg. |

**Pre-flight checks** before computing the diff (run in this order):

1. **Worktree-clean check.** Run `git status --porcelain`. If non-empty AND the chosen scope requires a branch switch, stop and tell the user to stash or commit first. Do not auto-stash. If the scope is `--staged` or no-arg on the current branch, dirty tree is fine — proceed.
2. **Untracked-file inspection.** Always run `git ls-files --others --exclude-standard`. If non-empty, list the excluded files in the report's Coverage section so the user knows what was outside scope. If any of them clearly belong in the review, stop and tell the user to `git add` them first; only continue when the user is intentionally reviewing tracked changes only.

**Rule mapping** — load only the rule files relevant to the diff. Every loaded rule costs tokens.

1. **Discover.** List `.claude/rules/**/*.md`. If that directory doesn't exist, fall back to whatever convention docs the repo uses (`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/conventions/`).
2. **Match by topic, not by hard-coded path.** Rule filenames name their domain — use the filename as the trigger.
   - `forms.md` → diff touches form components or imports a form library
   - `typescript.md` → diff touches `.ts` / `.tsx`
   - `react-components.md` → diff touches `.tsx` components
   - `tailwind.md` → diff touches classNames or `.css`
   - `state-management.md` → diff touches stores, context, or global state
   - `providers.md` → diff touches root layouts or provider trees
   - `file-organization.md` → diff creates, moves, or renames files
   - _(same pattern for any other rule file — the name is the trigger)_
3. **Nested scopes.** If `.claude/rules/apps/<app>/` or `.claude/rules/<topic>/` exists and the diff lives under that scope, load those too.
4. **Always-on rule.** Load the repo's dev-process / always-on rule if one exists (e.g. `dev-process.md`). The project's `AGENTS.md` / `CLAUDE.md` topic-rules index usually marks which rule is always-on.

Principle: rule filename = domain trigger. A new rule file added to the project auto-applies without editing this skill.

### Phase 2 — Intent map

Reconstruct what the author is trying to do **before** looking for bugs. Misread intent is the #1 source of noisy reviews.

Fill internally (will surface in the report header):

- **change_type**: fix | feature | refactor | migration | perf | chore
- **goal**: one sentence, author-perspective
- **expected_behavior**: 1–3 bullets of the user-visible outcome
- **invariants**: properties that must hold (e.g. "lock always released in finally", "auth required on write")
- **risk_surface**: which boundaries this touches (state, concurrency, auth, schema, rendering, public API)

**Past incidents.** Before spawning reviewers, grep `workspace/lessons.md` for keywords from the diff (filenames, function names, the change summary). Pick the top 3 most relevant entries. Pass them to each reviewer as a `<past-incidents>` block in the prompt. Skip if the file is missing or no keywords match — this is additive context, not a hard requirement. Promotes the existing dev-process habit ("after any correction, update workspace/lessons.md") into a first-class review input so repeated mistakes get caught early.

### Phase 3 — Risk route

Pick which specialist reviewer agents to spawn. Eleven specialists live in `.claude/agents/code-review/` — five run on every review, six are routed by the risk map from Phase 2.

| When | Agent |
| ---- | ----- |
| **Always** | `code-review-correctness` |
| **Always** | `code-review-convention` |
| **Always** | `code-review-tests` |
| **Always** | `code-review-maintainability` |
| **Always** | `code-review-agent-native` |
| locks, async state, streaming, queues, retries, cancellation, shared mutable state (module vars, refs, caches, datastore docs read-then-written), check-then-act shapes, idempotency surfaces, effect ordering assumptions | `code-review-concurrency` |
| auth, permissions, trust boundaries, user input, secrets | `code-review-security` |
| hot paths, render loops, N+1 access, large lists, database reads | `code-review-performance` |
| schema, migrations, data shape changes, schema validators | `code-review-data-integrity` |
| error handling, retries, timeouts, background jobs, external API calls, async work whose failure mode (vs. race) matters | `code-review-reliability` |
| PR mode only — `gh pr view` returned review threads on this PR | `code-review-previous-comments` |

Typical subset on a real PR: 5–8 agents total, cap at 9. Every agent spawn is tokens and wall-clock — do not route a conditional reviewer "just in case." If the diff has zero auth surface, do not spawn `code-review-security`. The always-on `code-review-agent-native` self-suppresses on diffs with no user-facing surface (returns `[]`), so it's safe to keep on by default — Mirror is an agent product and parity drift is the most distinctive failure mode in this codebase.

**Lane discipline.**
- Concurrency owns "what happens when two actors race"; reliability owns "what happens when one call fails." Route both only when both surfaces exist.
- Agent-native owns "can the clone speak from / act on this?"; security owns "does this leak across users?" Both touch RAG ingestion — agent-native flags the *parity gap* (clone is blind to the new content type), security flags the *isolation gap* (a poisoned source surfaces in another user's chat). Cite both reviewers when one diff trips both.

## Finding schema

Cross-cutting contract used by every reviewer in Phase 4 and by Normalize and Compose downstream. Every candidate finding fills:

```
id:                    short slug
reviewer:              correctness | convention | tests | maintainability | agent-native | concurrency | security | performance | data | reliability | previous-comments
title:                 one-line (must name the concrete failure mode or risk)
location:              file:startLine-endLine
priority:              P0 | P1 | P2 | P3
confidence:            0.0–1.0
observation:           what the code actually does
risk:                  the concrete failure mode or broken invariant (REQUIRED)
evidence:              quoted lines, rule reference, or prior incident
suggestedFix:          one sentence
autofix_class:         safe_auto | gated_auto | manual | advisory
owner:                 review-fixer | downstream-resolver | human | release
requires_verification: boolean — true means a fix is incomplete without a targeted regression test or operational check
pre_existing:          boolean — true means the diff did not introduce this; the change touched the area but the smell predates it
```

`priority` answers **urgency** (must-fix-before-merge, should-fix, nit). `autofix_class` + `owner` answer **what shape of fix the finding allows** — metadata for the downstream skill (`/resolve-issue-tickets`) that picks up the report, not a license for this skill to apply anything. The two axes are independent — a `P3` finding can still be `safe_auto` (a trivial mechanical fix) and a `P0` finding is almost always `manual` (security, concurrency, schema decisions need a human).

Routing rules enforced in Phase 5:
- Most-conservative route wins on disagreement. A merged finding may move from `safe_auto` to `gated_auto` or `manual`, but never the other way without new evidence.
- `requires_verification: true` means a fix is not complete without a targeted test, a focused re-review, or operational validation.
- `pre_existing: true` findings inform but do not block; they go in their own report section and do not count toward the verdict.

Every finding — regardless of `autofix_class` — is handed off to the user via Phase 7. This skill never applies fixes itself.

A finding with no `risk` is dropped at validation (Phase 5). Nits can skip `suggestedFix` but still need `risk`.

### Phase 4 — Review (parallel)

**Fleet-dispatch constraint.** If you have not dispatched the always-on reviewers (`code-review-correctness`, `code-review-convention`, `code-review-tests`, `code-review-maintainability`, `code-review-agent-native`) via the Agent tool by the end of this phase, **you have not run review-code**. Stop and dispatch. There is no small-diff bypass — a "quick inline review" is not this skill.

Spawn selected reviewers in parallel **and** run the repo's build + lint commands in parallel (discover from `package.json` scripts, `Makefile`, `justfile`, or whatever the repo uses). Each reviewer holds full attention on one dimension and proposes findings — they do not publish.

Each reviewer prompt must include:

1. **Scope** — the diff range, branch name, or path being reviewed.
2. **Changed files** — paths and line ranges.
3. **Intent packet** from Phase 2 verbatim: `change_type`, `goal`, `expected_behavior[]`, `invariants[]`, `risk_surface[]`.
4. **`<past-incidents>` block** — top 3 hits from `workspace/lessons.md` (skip if none).
5. **PR metadata** (`previous-comments` reviewer only): `<pr-context>` block with PR number, owner, repo, and review-thread API endpoint.
6. **Instruction to return findings as a JSON array** in the shared finding schema, including `priority`, `autofix_class`, `owner`, `requires_verification`, and `pre_existing`. Clean diffs return `[]` plus a one-line summary — do not invent findings.

Example orchestration (one message, parallel tool calls):

```
Agent(subagent_type: "code-review-correctness", prompt: <scope + files + intent + schema reminder>)
Agent(subagent_type: "code-review-convention",  prompt: <same>)
Agent(subagent_type: "code-review-tests",       prompt: <same>)
Agent(subagent_type: "code-review-concurrency", prompt: <same>)   // only if routed
```

Collect all agent results and the build/lint result before Phase 5. The build/lint outcome feeds the `Verified:` line in Phase 6's report header.

Reviewer agent definitions live in `.claude/agents/code-review/` — each has its own failure-mode checklist. Update those files when a reviewer needs to evolve, not this SKILL.md.

### Phase 5 — Normalize

Convert raw reviewer outputs into one deduplicated, confidence-gated finding set. Six steps, in order:

1. **Validate.** Drop findings that fail the schema (missing `risk`, missing `priority`, missing `autofix_class`, etc.). Record the drop count for the Coverage footer.
2. **Confidence gate.** Suppress findings below `0.60` confidence. Exception: P0 findings at `0.50+` survive — critical-but-uncertain issues must not be silently dropped. Record the suppressed count.
3. **Fingerprint dedup.** Compute a fingerprint per finding: `normalize(file) + line_bucket(line, ±3) + normalize(title)`. When fingerprints match across reviewers, merge into one canonical finding — keep the highest priority, keep the highest confidence with strongest evidence, union the evidence array, and list every contributing reviewer in the finding's provenance.
4. **Cross-reviewer agreement boost.** When 2+ independent reviewers fingerprint the same issue, boost the merged confidence by `+0.10` (capped at `0.98`). Independent convergence is stronger signal than any single reviewer's confidence.
5. **Disagreement preservation.** When reviewers flag the same fingerprint but disagree on `priority` or `autofix_class`, keep the most severe priority and the most conservative `autofix_class` (never widen `manual` → `safe_auto` without new evidence). Record the disagreement in the finding's evidence array (e.g. `"security rated P0, correctness rated P1 — kept P0"`) so the user can challenge the merge.
6. **Pre-existing partition.** Move every finding with `pre_existing: true` into a separate list. Pre-existing findings inform but do not block — they appear in their own report section and do not count toward the verdict.

Output: two finding lists — `findings` (this-PR-introduced) and `pre_existing`, both sorted by priority → confidence → file → line.

### Phase 6 — Rank + compose

**Halt-on-missing-fleet.** If fewer than 3 always-on reviewer results are present in this run's dispatch ledger when this phase begins, abort with `error: reviewer fleet not run` and return to Phase 4. Do not compose a report from a partial fleet.

Findings carry their priority directly (`P0`/`P1`/`P2`/`P3`). Within each tier, order by `confidence` desc → `file` → `line`. Tier definitions:

| Tier   | Label    | Maps to                                                                                |
| ------ | -------- | -------------------------------------------------------------------------------------- |
| **P0** | Critical | Correctness, data loss, auth bypass, concurrency, schema integrity — must fix before merge |
| **P1** | High     | Architecture violations, performance with real impact, missing tests on risky behavior, unaddressed substantive PR feedback |
| **P2** | Moderate | Design smells, missed simplifications, minor test gaps, unaddressed style PR feedback |
| **P3** | Low      | Nits, style, readability — advisory only                                               |

Compose the report (template below). Rules:

- Every finding has a `file:line` anchor in backticks (no vague "in the auth module").
- Use pipe-delimited markdown tables, never ASCII box-drawing or freeform prose.
- Omit empty priority sections.
- If the whole change is clean, say so in one sentence — don't invent findings.
- The Phase 4 build/lint result goes in the `Verified:` header line.
- Always end with Summary table and Recommended next step.
- If lint caught something, cite lint output instead of re-listing it as a finding.
- **Pre-existing findings** go in their own section AFTER the Pn tiers and AFTER "Looks good"; they have their own row in the Summary table and do NOT count toward the verdict tiers.
- **Disagreement** among reviewers on the same finding stays visible in the finding's evidence (the merged record from Phase 5 step 5).
- The findings table includes a `Route` column showing the `autofix_class` (`safe` / `gated` / `manual` / `advisory`) so the user can see at a glance which findings the skill could auto-fix vs. which need owner judgment.

**Format verification self-check** (mandatory before delivering): re-read the report and confirm findings rendered as pipe-delimited table rows (`| # | File | Issue | ... |`), not as freeform prose blocks separated by horizontal rules. If you catch yourself using prose, stop and reformat into tables.

### Phase 7 — Hand off

The report from Phase 6 is the terminal output. Do **not** file tickets, apply fixes, run additional verification commands, or re-spawn agents from this point. The skill's job is the prioritized findings list — acting on those findings is a separate cycle that uses different primitives.

**Tickets are filed only through `/generate-issue-tickets`.** If the user asks this skill (or any orchestrator that called it) to "create tickets from these findings," the response is to invoke the slash command — never write to `workspace/tickets/to-do/` via raw `Write`. Bypassing the skill skips its preflight (ID scan, scope rubric, frontmatter contract, validator hook) and has silently produced under-scoped tickets in past sessions. The slash command is the only sanctioned path.

Append a single handoff line after the report's `Recommended next step`. Pick the wording that matches the findings:

- Any P0/P1 findings → _"To act on this: run `/generate-issue-tickets` with the P0/P1 rows from this report (one ticket per row), then run `/resolve-issue-tickets` to work through them in parallel waves."_
- Only P2/P3 (or `safe_auto`-style mechanical nits) → _"To act on this: hand the report to me with a specific finding number (e.g., 'fix #3') and I'll do that single edit, or run `/generate-issue-tickets` for anything you want to track."_
- Clean diff (zero findings) → _"Ready to merge."_ (no handoff line needed)

**Why this shape.** Inline fix loops in the orchestrator stack the parallel-reviewer outputs, the merged findings, the per-fix Read/edit/test cycles, and the build/lint output into one session — context-compaction territory. The handoff splits the work: parallel agents produce the report cheaply; downstream skills (each with their own orchestrator) act on it without dragging the review context along.

`/resolve-issue-tickets` already runs executor + verifier sub-agents per ticket in waves; it is the correct downstream primitive for any non-trivial fix slate. For a single one-line fix the user can just say "fix #N" and the conversation handles it without skill machinery.

## Report format

```markdown
## Code Review Results

**Scope:** <merge-base description> (<N files, M lines>)
**Intent:** <one sentence — what the author is trying to do>
**Verified:** build ✓/✗ lint ✓/✗

**Reviewers:** <comma-separated list of active reviewers>

- <routed reviewer> -- <one-line reason it was routed>

### P0 — Critical (<count>)

| #   | File                  | Issue                           | Route     | Confidence |
| --- | --------------------- | ------------------------------- | --------- | ---------- |
| 1   | `path/to/file.tsx:42` | <title — concrete failure mode> | manual    | 0.XX       |

### P1 — High (<count>)

### P2 — Moderate (<count>)

### P3 — Low (<count>)

(same table shape; omit empty sections; `Route` shows `safe` / `gated` / `manual` / `advisory`)

### Looks good

- <one-line positive callout, if any>

### Pre-existing (<count>)

| #   | File                  | Issue                           | Priority | Confidence |
| --- | --------------------- | ------------------------------- | -------- | ---------- |
| 1   | `path/to/file.tsx:88` | <title>                         | P2       | 0.XX       |

These predate this diff. They do not count toward the verdict but are surfaced for awareness.

### Summary

| Priority                       | Count |
| ------------------------------ | ----- |
| P0 Critical                    | N     |
| P1 High                        | N     |
| P2 Moderate                    | N     |
| P3 Low                         | N     |
| **Total (this PR)**            | **N** |
| Pre-existing (informational)   | N     |

### Recommended next step

<one sentence: what to do first — e.g., "Fix P0 #1 before merge, then address P1 items." or "Clean diff — ready to merge.">

<optional handoff line per Phase 7 — include ONLY when findings exist; for clean diffs end at "Ready to merge." above. When present, picks the variant matching the finding tiers (P0/P1 → /generate-issue-tickets + /resolve-issue-tickets; P2/P3 only → "fix #N" or /generate-issue-tickets). Never offers in-skill auto-fixing.>
```

## Example

**Input:** user says "review my changes" on a branch that fixes a chat streaming race.

**Output (abridged):**

```markdown
## Code Review Results

**Scope:** main...fix-chat-message-system (3 files, 91 lines)
**Intent:** Prevent the streaming lock from remaining stuck when a request is cancelled mid-stream
**Verified:** build ✓ lint ✓

**Reviewers:** correctness, convention, tests, maintainability, agent-native, concurrency

- concurrency -- lock lifecycle and cleanup paths in streaming code
- agent-native -- chat-streaming change touches the clone agent surface; verify parity holds

### P0 — Critical (1)

| #   | File                                     | Issue                                                                                                                 | Route  | Confidence |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1   | `packages/convex/chat/stream.ts:118-131` | Cleanup skipped on early return — `streamingInProgress` stays set after cancellation, blocking all subsequent streams | manual | 0.95       |

### Summary

| Priority                     | Count |
| ---------------------------- | ----- |
| P0 Critical                  | 1     |
| **Total (this PR)**          | **1** |
| Pre-existing (informational) | 0     |

### Recommended next step

Move the lock release into a `finally` block before merge.

To act on this: run `/generate-issue-tickets` with the P0 row from this report, then run `/resolve-issue-tickets` to work it through executor + verifier agents.
```
