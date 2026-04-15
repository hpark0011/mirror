---
name: reviewing-code
argument-hint: "[path | branch | --staged]"
description: Reviews pending code changes in this monorepo against AGENTS.md and .claude/rules/, producing a prioritized findings report. Use when the user says "review this code", "code review", "review my changes", "check this before I commit", or asks for feedback on a diff, branch, or file. Distinct from review-pr (fetches GitHub PR comments) and security-review (threat-model focused).
---

# Reviewing Code

Senior-engineer code review tuned to this repo's conventions. Instead of one flat pass, the skill runs a **pipeline of judgment**: understand intent, route to narrow reviewers, collect candidate findings, critique them ruthlessly, then compose only what matters.

The core rule: **every finding must name a concrete failure mode or broken invariant.** Style preferences without a risk story get dropped by the Critic phase.

## Scope & non-goals

- **Not for GitHub PR comments** — use [`review-pr`](../review-pr/SKILL.md).
- **Not a rewrite pass** — propose changes, don't silently apply them. Only edit if the user says "fix it" after the report.
- **Not a substitute for `pnpm build` / `pnpm lint`** — run those too; this skill catches what linters can't.
- **Orchestrator + specialists, not a swarm.** Phase 4 fans out to parallel specialist sub-agents (one per reviewer), but Intent, Normalize, Critique, and Compose all run in the orchestrator so the critic has one consistent voice. Cap the routed subset at ~5 agents — more coordination, diminishing returns.

## Quick start

1. Identify the change set (arg, `--staged`, or `main...HEAD`).
2. Run the 7-phase pipeline: Ingest → Intent → Route → Reviewer pass → Normalize → Critique → Compose.
3. Emit a report with an Intent block up top, findings written as **Observation → Risk → Suggestion**, and a "Filtered by critic" footer.
4. Capture blockers and should-fix items as tickets via [`generate-issue-tickets`](../generate-issue-tickets/SKILL.md).
5. Ask if the user wants fixes applied.

## Workflow

```
- [ ] 1. Ingest    — scope, changed files, read each file fully, build packet
- [ ] 2. Intent    — infer change type, goal, expected behavior, invariants, risk surface
- [ ] 3. Route     — pick reviewers based on the risk map (correctness/convention/tests always)
- [ ] 4. Reviewer pass — each selected reviewer emits candidate findings in the shared schema
- [ ] 5. Normalize — dedupe and merge overlapping findings; preserve provenance
- [ ] 6. Critique  — reject speculative/stylistic/misread findings; log reasons
- [ ] 7. Compose   — rank by severity × confidence × blast radius; write the report
- [ ] 8. Verify    — pnpm build + lint per .claude/rules/verification.md
- [ ] 9. Tickets   — file blockers/should-fix via generate-issue-tickets
- [ ] 10. Offer fixes
```

### Phase 1 — Ingest

Determine scope and build the review packet. Read files in full; context lives outside the hunks.

| Input       | Command                    |
| ----------- | -------------------------- |
| No arg      | `git diff main...HEAD`     |
| `--staged`  | `git diff --staged`        |
| Branch name | `git diff main...<branch>` |
| File or dir | `git diff main -- <path>`  |

If the working tree is clean and no arg given, ask the user what to review instead of guessing.

**Rule mapping** — load only `.claude/rules/` files that match touched paths. Every loaded rule costs tokens.

| If the diff touches…                     | Load                                    |
| ---------------------------------------- | --------------------------------------- |
| `packages/convex/**`                     | `.claude/rules/convex.md`               |
| `**/forms/**`, `react-hook-form` imports | `.claude/rules/forms.md`                |
| `*.tsx` components                       | `.claude/rules/react-components.md`     |
| `store/`, context providers              | `.claude/rules/state-management.md`     |
| Tailwind classes, `*.css`                | `.claude/rules/tailwind.md`             |
| `*.ts` types, generics                   | `.claude/rules/typescript.md`           |
| `providers/`, root layouts               | `.claude/rules/providers.md`            |
| New/moved/renamed files                  | `.claude/rules/file-organization.md`    |
| `apps/mirror/**`                         | `.claude/rules/apps/mirror/**`          |
| Anything                                 | `.claude/rules/dev-process.md` (always) |

### Phase 2 — Intent map

Reconstruct what the author is trying to do **before** looking for bugs. Misread intent is the #1 source of noisy reviews.

Fill internally (will surface in the report header):

- **change_type**: fix | feature | refactor | migration | perf | chore
- **goal**: one sentence, author-perspective
- **expected_behavior**: 1–3 bullets of the user-visible outcome
- **invariants**: properties that must hold (e.g. "lock always released in finally", "auth required on write")
- **risk_surface**: which boundaries this touches (state, concurrency, auth, schema, rendering, public API)

If the PR description contradicts the diff, stop and surface that in the report instead of producing line-level findings on a misread goal.

### Phase 3 — Risk route

Pick which specialist reviewer agents to spawn. Seven specialists live in `.claude/agents/code-review/` — three run on every review, four are routed by the risk map from Phase 2.

| When                                                           | Agent                          |
| -------------------------------------------------------------- | ------------------------------ |
| **Always**                                                     | `code-review-correctness`      |
| **Always**                                                     | `code-review-convention`       |
| **Always**                                                     | `code-review-tests`            |
| locks, async state, streaming, queues, retries, cancellation   | `code-review-concurrency`      |
| auth, permissions, trust boundaries, user input, secrets       | `code-review-security`         |
| hot paths, render loops, N+1 access, large lists, Convex reads | `code-review-performance`      |
| schema, migrations, data shape changes, Convex validators      | `code-review-data-integrity`   |

A CSS-only diff collapses to the three always-on reviewers. Don't spawn routed reviewers that don't apply — every agent spawn is tokens and wall-clock time. Typical subset on a real PR: 3–5 agents total, cap at 5.

### Phase 4 — Parallel reviewer pass

Each reviewer runs as a **separate specialist sub-agent** with a narrow system prompt, so each reviewer holds full attention on one dimension. Reviewer agents produce candidate findings in the shared schema — they do not publish, they propose.

**Spawn all selected reviewer agents in a single message with multiple parallel `Agent` tool calls.** Do not spawn them sequentially — the whole point is fan-out.

Each prompt must include:

1. **Scope** — the diff range, branch name, or path being reviewed.
2. **Changed files** — paths and line ranges. Tell the agent to read each file end-to-end, not just the hunks.
3. **Intent packet** from Phase 2 verbatim: `change_type`, `goal`, `expected_behavior[]`, `invariants[]`, `risk_surface[]`.
4. **Instruction to return findings as a JSON array** in the shared finding schema (below). Clean diffs return `[]` plus a one-line summary — do not invent findings.

Example orchestration (one message, parallel tool calls):

```
Agent(subagent_type: "code-review-correctness", prompt: <scope + files + intent + schema reminder>)
Agent(subagent_type: "code-review-convention",  prompt: <same>)
Agent(subagent_type: "code-review-tests",       prompt: <same>)
Agent(subagent_type: "code-review-concurrency", prompt: <same>)   // only if routed
```

Collect all agent results before moving to Phase 5. If an agent times out or errors, note it in the report's "Filtered by critic" footer and proceed — don't block on a single specialist.

**Reviewer agent definitions live in `.claude/agents/code-review/`** (one file per reviewer) — each has its own failure-mode checklist. Update those files when a reviewer needs to evolve, not this SKILL.md.

### Shared finding schema

Every candidate finding, regardless of reviewer, fills:

```
id:          short slug
reviewer:        correctness | convention | tests | concurrency | security | performance | data | api
title:       one-line
location:    file:startLine-endLine
severity:    low | medium | high | critical
confidence:  0.0–1.0
observation: what the code actually does (1–2 sentences)
risk:        the concrete failure mode or broken invariant (REQUIRED)
evidence:    quoted lines, rule reference, or prior incident
suggestedFix: one sentence
```

**Hard rule:** a finding with no `risk` is dropped by the Critic. No exceptions. Nits can skip `suggestedFix` but still need `risk` (even if the risk is "small but real readability hazard in a hot file").

### Phase 5 — Normalize

Merge overlapping findings from different reviewers into one canonical finding. Example: Correctness says "cleanup skipped on early return" and Concurrency says "lock may remain stuck" — these become one high-confidence finding with both reviewers as supporting provenance.

Dedupe by `location` + `risk` similarity. Sum confidence conservatively (cap at 0.98).

### Phase 6 — Critique (mandatory quality gate)

This is the single biggest lever on review quality. Do not skip it.

For each normalized finding, answer:

1. Is it grounded in the diff and the surrounding code I actually read? (Not speculation.)
2. Does it name a real invariant or failure mode, not a preference?
3. Is severity proportional to blast radius?
4. Would a senior engineer on this repo actually say this?
5. Does it contradict the PR's stated intent — i.e., did I misread the goal?
6. Does `.claude/rules/dev-process.md` apply — am I about to ship a bandaid fix or rubber-stamp?

Reject findings that fail any check. **Log each rejection with a one-line reason** — this becomes the "Filtered by critic" footer in the report and is how the user can challenge the filter.

**Self-check:** if the Critic rejects zero findings on a non-trivial diff, the phase didn't actually run. Go back and re-apply it honestly.

### Phase 7 — Rank + compose

Rank surviving findings by `severity × confidence × blast_radius`. Priority order when in doubt:

1. Correctness / data loss / auth / concurrency
2. Architecture violations with long-term cost
3. Missing tests on risky behavior
4. Performance with real impact
5. Maintainability
6. Nits

Write the report (see format below). Every blocker and should-fix item is a short paragraph structured as **Observation → Risk → Suggestion**, not a one-liner. Nits stay one-liners.

### Phase 8 — Verify

Run `pnpm build` + `pnpm lint` for the affected app per `.claude/rules/verification.md`. Record pass/fail in the report header. If lint catches something, point at lint output instead of re-listing it as a finding.

### Phase 9 — Tickets

Invoke [`generate-issue-tickets`](../generate-issue-tickets/SKILL.md) for every blocker and should-fix finding. One ticket per finding. Preserve the `file:line` anchor and the `risk` sentence in the ticket body. Do this **before** offering fixes so tickets exist even if the user defers the work.

### Phase 10 — Offer fixes

End with: _"Want me to apply the blockers / should-fix items?"_ Do not fix preemptively. If the user says yes, apply edits and re-run build + lint per `verification.md`.

## Report format

```text
## Code Review — <scope>

**Files changed:** N  |  **Lines:** +X / -Y
**Verified:** build ✓/✗  lint ✓/✗

### Intent
- **Goal:** <one sentence — what the author is trying to do>
- **Invariants:** <1–3 bullets that must hold>
- **Risk surface:** <touched boundaries>

### 🔴 Blockers (fix before merge)

**path/to/file.tsx:42** — <title>
_Observation._ <what the code does.>
_Risk._ <concrete failure mode or broken invariant.>
_Suggestion._ <one-sentence fix direction.>

### 🟡 Should fix

**path/to/file.ts:17** — <title>
_Observation._ …
_Risk._ …
_Suggestion._ …

### 🟢 Nits
- **path/to/file.css:8** — <one-liner with risk, even if small>

### ✅ Looks good
- <one-line positive callout, if any>

### Filtered by critic (N)
- <finding title> — <rejection reason>
```

Report rules:

- Every finding has a `file:line` anchor. No vague "in the auth module".
- **Blockers** = correctness, security, convention violations with known past incidents.
- **Should fix** = design smells, missed simplifications, test gaps on risky behavior.
- **Nits** = small issues a linter would catch or near-miss readability.
- If the whole change is clean, say so in one sentence — don't invent findings. The "Filtered by critic" footer can still show what you considered.

## Examples

**Input:** user says "review my changes" on a branch that fixes a chat streaming race.

**Output (abridged):**

```text
## Code Review — fix-chat-message-system

**Files changed:** 3  |  **Lines:** +87 / -4
**Verified:** build ✓  lint ✓

### Intent
- **Goal:** Prevent the streaming lock from remaining stuck when a request is cancelled mid-stream.
- **Invariants:** lock always released via clearStreamingLock(expectedStartedAt); stale callbacks cannot clear an active lock.
- **Risk surface:** concurrency, state cleanup.

### 🔴 Blockers

**packages/convex/chat/stream.ts:118-131** — Cleanup skipped on early return
_Observation._ When `shouldAbort` is true the function returns before reaching `clearStreamingLock`, which only runs on the success path.
_Risk._ `streamingInProgress` stays set after cancellation, blocking every subsequent stream for that conversation — this is the exact invariant the PR claims to fix.
_Suggestion._ Move the lock release into a `finally` block guarded by `expectedStartedAt` so both branches run it.

### 🟡 Should fix

**packages/convex/chat/stream.test.ts** — No test for the interrupted-stream path
_Observation._ Tests cover the happy path and the error path but not the cancellation path that the fix targets.
_Risk._ No regression protection — the same bug can return silently.
_Suggestion._ Add a test that cancels mid-stream and asserts `streamingInProgress` is cleared.

### 🟢 Nits
- **apps/mirror/app/(chat)/chat-input.tsx:5** — unused `cn` import (trivial, but it lives in a hot file).

### Filtered by critic (2)
- "Rename `expectedStartedAt` to `streamToken`" — style preference, no risk named.
- "Extract cleanup into a helper" — speculative refactor, not requested by the PR intent.

Want me to apply the blockers and should-fix items?
```

## Anti-patterns

- **Running every reviewer on every diff.** Route by risk map. A CSS tweak doesn't need the security reviewer.
- **Findings without a `risk` field.** If you can't name a failure mode or broken invariant, it's a preference — drop it.
- **Critic that rubber-stamps.** Zero rejects on a non-trivial diff means the phase didn't run.
- **Style preferences dressed as blockers.** Severity must match blast radius, not conviction.
- **Skipping the Intent block** because "the diff is obvious." The diff is never obvious — write it.
- **Reviewing the diff without reading the whole file.** Context lives outside the hunks.
- **Inventing findings to justify the review.** A clean diff deserves "looks good" in one line.
- **Rewriting the code in the report.** Point at the problem; let the author write the fix.
- **Loading every rule file regardless of scope.** Map paths to rules.
- **Mixing review with fixes in the same pass.** Report first, ask, then fix.
- **Duplicating `pnpm lint`.** If ESLint catches it, cite lint output instead of re-listing.
