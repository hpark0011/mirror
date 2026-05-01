---
name: reviewing-code
argument-hint: "[path | branch | --staged]"
description: Reviews pending code changes in this monorepo against AGENTS.md and .claude/rules/, producing a prioritized findings report. Use when the user says "review this code", "code review", "review my changes", "check this before I commit", or asks for feedback on a diff, branch, or file. Distinct from review-pr (fetches GitHub PR comments) and security-review (threat-model focused).
---

# Reviewing Code

Senior-engineer code review tuned to this repo's conventions. A pipeline of judgment: understand intent, route to narrow reviewers, collect findings, critique them, compose only what matters.

**Core rule:** every finding must name a concrete failure mode or broken invariant. Style preferences without a risk story get dropped by the Critic.

## Stop conditions

Pause and surface instead of pressing on when:

- Working tree is clean and no arg given — ask what to review.
- The PR description contradicts the diff — surface the contradiction in the report; do not produce line-level findings on a misread goal.
- A reviewer sub-agent times out or errors — note it in the "Filtered by critic" footer and proceed; don't block on a single specialist.

## Workflow

```
- [ ] 1. Ingest    — scope, changed files, read each file fully, load matching rules
- [ ] 2. Intent    — infer change type, goal, expected behavior, invariants, risk surface
- [ ] 3. Route     — pick reviewers based on the risk map (correctness/convention/tests always)
- [ ] 4. Review    — spawn selected reviewers AND run build+lint in parallel
- [ ] 5. Normalize — dedupe and merge overlapping findings; preserve provenance
- [ ] 6. Critique  — reject speculative/stylistic/misread findings; log reasons
- [ ] 7. Compose   — rank by severity × confidence × blast radius; write the report with Verify result
- [ ] 8. Tickets   — file blockers/should-fix via generate-issue-tickets
- [ ] 9. Offer fixes
```

### Phase 1 — Ingest

Determine scope and build the review packet. Read files in full; context lives outside the hunks.

| Input       | Command                    |
| ----------- | -------------------------- |
| No arg      | `git diff main...HEAD`     |
| `--staged`  | `git diff --staged`        |
| Branch name | `git diff main...<branch>` |
| File or dir | `git diff main -- <path>`  |

**Rule mapping** — load only the rule files relevant to the diff. Every loaded rule costs tokens.

1. **Discover.** List `.claude/rules/**/*.md`. If that directory doesn't exist, fall back to whatever convention docs the repo uses (`AGENTS.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/conventions/`).
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
4. **Always-on rule.** Load the repo's dev-process / always-on rule if one exists (e.g. `dev-process.md`). The project's `AGENTS.md` / `AGENTS.md` topic-rules index usually marks which rule is always-on.

Principle: rule filename = domain trigger. A new rule file added to the project auto-applies without editing this skill.

### Phase 2 — Intent map

Reconstruct what the author is trying to do **before** looking for bugs. Misread intent is the #1 source of noisy reviews.

Fill internally (will surface in the report header):

- **change_type**: fix | feature | refactor | migration | perf | chore
- **goal**: one sentence, author-perspective
- **expected_behavior**: 1–3 bullets of the user-visible outcome
- **invariants**: properties that must hold (e.g. "lock always released in finally", "auth required on write")
- **risk_surface**: which boundaries this touches (state, concurrency, auth, schema, rendering, public API)

### Phase 3 — Risk route

Pick which specialist reviewer agents to spawn. Seven specialists live in `.claude/agents/code-review/` — three run on every review, four are routed by the risk map from Phase 2.

| When                                                                                                                                                                                                                       | Agent                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Always**                                                                                                                                                                                                                 | `code-review-correctness`    |
| **Always**                                                                                                                                                                                                                 | `code-review-convention`     |
| **Always**                                                                                                                                                                                                                 | `code-review-tests`          |
| locks, async state, streaming, queues, retries, cancellation, shared mutable state (module vars, refs, caches, datastore docs read-then-written), check-then-act shapes, idempotency surfaces, effect ordering assumptions | `code-review-concurrency`    |
| auth, permissions, trust boundaries, user input, secrets                                                                                                                                                                   | `code-review-security`       |
| hot paths, render loops, N+1 access, large lists, database reads                                                                                                                                                           | `code-review-performance`    |
| schema, migrations, data shape changes, schema validators                                                                                                                                                                  | `code-review-data-integrity` |

Typical subset on a real PR: 3–5 agents total, cap at 5. Every agent spawn is tokens and wall-clock.

## Finding schema

Cross-cutting contract used by every reviewer in Phase 4 and by Normalize, Critique, and Compose downstream. Every candidate finding fills:

```
id:          short slug
reviewer:    correctness | convention | tests | concurrency | security | performance | data | api
title:       one-line (must name the concrete failure mode or risk)
location:    file:startLine-endLine
priority:    P0 | P1 | P2 | P3
confidence:  0.0–1.0
observation: what the code actually does
risk:        the concrete failure mode or broken invariant (REQUIRED)
evidence:    quoted lines, rule reference, or prior incident
suggestedFix: one sentence
```

A finding with no `risk` is dropped by the Critic. Nits can skip `suggestedFix` but still need `risk`.

### Phase 4 — Review (parallel)

Spawn selected reviewers in parallel **and** run the repo's build + lint commands in parallel (discover from `package.json` scripts, `Makefile`, `justfile`, or whatever the repo uses). Each reviewer holds full attention on one dimension and proposes findings — they do not publish.

Each reviewer prompt must include:

1. **Scope** — the diff range, branch name, or path being reviewed.
2. **Changed files** — paths and line ranges.
3. **Intent packet** from Phase 2 verbatim: `change_type`, `goal`, `expected_behavior[]`, `invariants[]`, `risk_surface[]`.
4. **Instruction to return findings as a JSON array** in the shared finding schema. Clean diffs return `[]` plus a one-line summary — do not invent findings.

Example orchestration (one message, parallel tool calls):

```
Agent(subagent_type: "code-review-correctness", prompt: <scope + files + intent + schema reminder>)
Agent(subagent_type: "code-review-convention",  prompt: <same>)
Agent(subagent_type: "code-review-tests",       prompt: <same>)
Agent(subagent_type: "code-review-concurrency", prompt: <same>)   // only if routed
```

Collect all agent results and the build/lint result before Phase 5. The build/lint outcome feeds the `Verified:` line in Phase 7's report header.

Reviewer agent definitions live in `.claude/agents/code-review/` — each has its own failure-mode checklist. Update those files when a reviewer needs to evolve, not this SKILL.md.

### Phase 5 — Normalize

Merge overlapping findings from different reviewers into one canonical finding. Example: Correctness says "cleanup skipped on early return" and Concurrency says "lock may remain stuck" — these become one high-confidence finding with both reviewers as supporting provenance.

Dedupe by `location` + `risk` similarity. Sum confidence conservatively (cap at 0.98).

### Phase 6 — Critique (mandatory quality gate)

The single biggest lever on review quality. For each normalized finding, answer:

1. Is it grounded in the diff and the surrounding code I actually read? (Not speculation.)
2. Does it name a real invariant or failure mode, not a preference?
3. Is severity proportional to blast radius?
4. Would a senior engineer on this repo actually say this?
5. Does it contradict the PR's stated intent — i.e., did I misread the goal?
6. Does the always-on dev-process rule apply — am I about to ship a bandaid or rubber-stamp?

Reject findings that fail any check. **Log each rejection with a one-line reason** — this becomes the "Filtered by critic" footer and is how the user can challenge the filter.

**Self-check:** if the Critic rejects zero findings on a non-trivial diff, the phase didn't actually run. Go back and re-apply it honestly.

### Phase 7 — Rank + compose

Rank surviving findings by `severity × confidence × blast_radius` into four priority tiers:

| Tier   | Label    | Maps to                                                                                |
| ------ | -------- | -------------------------------------------------------------------------------------- |
| **P0** | Critical | Correctness, data loss, auth bypass, concurrency — must fix before merge               |
| **P1** | High     | Architecture violations, performance with real impact, missing tests on risky behavior |
| **P2** | Moderate | Design smells, missed simplifications, minor test gaps                                 |
| **P3** | Low      | Nits, style, readability — advisory only                                               |

Compose the report (template below). Rules: every finding has a `file:line` anchor in backticks (no vague "in the auth module"); use pipe-delimited markdown tables, never ASCII box-drawing; omit empty priority sections; if the whole change is clean, say so in one sentence — don't invent findings; the Phase 4 build/lint result goes in the `Verified:` header line; always end with Summary table and Recommended next step; if lint caught something, cite lint output instead of re-listing it as a finding.

### Phase 8 — Tickets

Invoke [`generate-issue-tickets`](../generate-issue-tickets/SKILL.md) for every blocker and should-fix finding. One ticket per finding. Preserve the `file:line` anchor and the `risk` sentence in the ticket body. Do this **before** offering fixes so tickets exist even if the user defers the work.

### Phase 9 — Offer fixes

End with: _"Want me to apply the blockers / should-fix items?"_ Do not fix preemptively. If the user says yes, apply edits and re-run build + lint.

## Report format

```markdown
## Code Review Results

**Scope:** <merge-base description> (<N files, M lines>)
**Intent:** <one sentence — what the author is trying to do>
**Verified:** build ✓/✗ lint ✓/✗

**Reviewers:** <comma-separated list of active reviewers>

- <routed reviewer> -- <one-line reason it was routed>

### P0 — Critical (<count>)

| #   | File                  | Issue                           | Reviewer   | Confidence |
| --- | --------------------- | ------------------------------- | ---------- | ---------- |
| 1   | `path/to/file.tsx:42` | <title — concrete failure mode> | <reviewer> | 0.XX       |

### P1 — High (<count>)

### P2 — Moderate (<count>)

### P3 — Low (<count>)

(same table shape; omit empty sections)

### Looks good

- <one-line positive callout, if any>

### Filtered by critic (<count>)

- <finding title> — <rejection reason>

### Summary

| Priority    | Count |
| ----------- | ----- |
| P0 Critical | N     |
| P1 High     | N     |
| P2 Moderate | N     |
| P3 Low      | N     |
| **Total**   | **N** |

### Recommended next step

<one sentence: what to do first — e.g., "Fix P0 #1 before merge, then address P1 items." or "Clean diff — ready to merge.">

Want me to apply fixes for the P0/P1 items?
```

## Example

**Input:** user says "review my changes" on a branch that fixes a chat streaming race.

**Output (abridged):**

```markdown
## Code Review Results

**Scope:** main...fix-chat-message-system (3 files, 91 lines)
**Intent:** Prevent the streaming lock from remaining stuck when a request is cancelled mid-stream
**Verified:** build ✓ lint ✓

**Reviewers:** correctness, convention, tests, concurrency

- concurrency -- lock lifecycle and cleanup paths in streaming code

### P0 — Critical (1)

| #   | File                                     | Issue                                                                                                                 | Reviewer                 | Confidence |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| 1   | `packages/convex/chat/stream.ts:118-131` | Cleanup skipped on early return — `streamingInProgress` stays set after cancellation, blocking all subsequent streams | concurrency, correctness | 0.95       |

### Filtered by critic (1)

- "Rename `expectedStartedAt` to `streamToken`" — style preference, no risk named.

### Summary

| Priority    | Count |
| ----------- | ----- |
| P0 Critical | 1     |
| **Total**   | **1** |

### Recommended next step

Move the lock release into a `finally` block before merge.

Want me to apply fixes for the P0 item?
```
