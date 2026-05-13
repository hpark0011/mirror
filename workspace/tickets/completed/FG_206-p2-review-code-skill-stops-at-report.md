---
id: FG_206
title: "/review-code skill terminates at report; fix loop moves to executor agents"
date: 2026-05-13
type: refactor
status: completed
priority: p2
description: "The /review-code skill currently dispatches 9-10 parallel specialist reviewers (good) and then runs the resulting fix loop inside the main session (bad). Long-running review-code invocations have hit context compaction mid-fix, generated 9+ revert markers, and burned hundreds of turns. Split the skill so phase 1 ends at the prioritized report and any subsequent fixes are routed to executor sub-agents (or to /resolve-issue-tickets) that keep the main orchestrator context clean."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - ".claude/skills/review-code/SKILL.md describes phase 1 (parallel review fan-out → merged prioritized report) as the terminal state for the skill — the final assistant message is the report, not a fix plan."
  - "SKILL.md adds an explicit handoff section telling the user how to take the report into a fix loop (e.g., 'paste the P1/P2 findings into /generate-issue-tickets, then /resolve-issue-tickets')."
  - "SKILL.md removes any phase that performs Edit/Write/MultiEdit in the orchestrator session after agents return. If interactive fix-then-verify still belongs in the skill, it is delegated to a single executor sub-agent invocation per finding, not inline edits in the orchestrator."
  - "A retro re-run on a /review-code session executed after this change shows zero context-compaction events and < 200 main-session turns end-to-end. Document the retro numbers in the PR description."
  - "grep -n 'Edit\\|Write\\|MultiEdit' .claude/skills/review-code/SKILL.md returns no occurrences of those tools as actions the orchestrator performs (only references inside agent prompts are allowed)."
owner_agent: "Skill author familiar with the .claude/skills/ orchestration pattern and the existing review-code dispatcher"
---

# /review-code skill terminates at report; fix loop moves to executor agents

## Context

Surfaced by `/retro` on 2026-05-13 over the last 10 dev sessions. The
`/review-code` skill is the largest per-session token sink in the
project. Two same-week invocations show the divergence:

- **`0d5895f2`** — PR #93 review, clean run: skill dispatched 10
  specialist agents in parallel, produced a report, terminated.
  **116 turns, 14 min wall time, 0 edits.**
- **`2c8eccf2`** — contact-panel review on a working branch: same skill,
  same agent fan-out, but the orchestrator then iterated through
  findings and performed fixes inline. **596 turns, 871 min wall time,
  context compaction occurred mid-session, 9 revert keyword hits,
  4 frustration keyword hits, 32 file edits.**

The pattern: when the report is the terminal output, the skill is
extremely cheap and fast. When the orchestrator continues into a
"resolve findings" loop, it does Read → Edit → re-test cycles in the
main context, which holds all the agent outputs plus all the edit
history. That's where compaction fires.

The repo already has the right primitive for fix orchestration:
`/resolve-issue-tickets`. It dispatches per-ticket executor + verifier
sub-agents in waves and reports back, so the main session never carries
edit history. `/review-code` should hand off to that primitive instead
of duplicating the loop.

## Goal

After running `/review-code`, the assistant's final turn is a structured
prioritized report. Nothing else. If the user wants to act on the
report, they run a separate skill — and the main session stays under
~200 turns for any review, regardless of how many findings exist.

## Scope

- Edit `.claude/skills/review-code/SKILL.md` to terminate at the merged
  prioritized report.
- Remove any "Phase 4: Apply fixes" / "Phase 5: Verify" instructions
  that direct the orchestrator to call Edit/Write/MultiEdit on its own.
- Add a short "Handing off to fixers" section describing two flows:
  (a) `/generate-issue-tickets` from the P1/P2 findings followed by
  `/resolve-issue-tickets`, and (b) for a single-file finding, plain
  user direction to fix.

## Out of Scope

- Changing the parallel-agent dispatch (`code-review-*` specialist
  agents). They stay as-is — the orchestration up to the report is
  working well per `0d5895f2`.
- Editing `.claude/skills/resolve-issue-tickets/SKILL.md`. The handoff
  uses it as-is.
- Any change to `/review-pr` (different skill, different ticket —
  FG_207's sibling problem lives elsewhere).

## Approach

Read the current `.claude/skills/review-code/SKILL.md`. Identify the
phase boundary where parallel agents return their findings and the
report is merged. Make that phase the skill's terminal output. Any
later phases that direct the orchestrator to Edit / Write / re-test
get either deleted or moved into the agent prompts themselves (so a
sub-agent does the work, not the main session).

- **Effort:** Small
- **Risk:** Low — the change is documentation-only inside a skill file;
  no executable code paths.

## Implementation Steps

1. Read `.claude/skills/review-code/SKILL.md` end to end.
2. Identify and remove orchestrator-side fix instructions (anything
   telling the main session to Edit/Write after the report is merged).
3. Add the handoff section pointing at `/generate-issue-tickets` →
   `/resolve-issue-tickets`.
4. Trigger `/review-code` on this very branch as a smoke test; confirm
   the skill terminates at the report and that running
   `/resolve-issue-tickets` against P1/P2 findings (if any) keeps the
   main session under 200 turns.
5. Document the before/after retro turn counts in the PR description.

## Constraints

- Must not change the parallel review agent prompts themselves —
  only the orchestrator's post-merge behavior.
- The skill must still produce a single, prioritized, deduplicated
  report (the merge logic stays).
- Backwards-compat is irrelevant: this is a workflow change, no callers
  depend on the orchestrator doing fixes.

## Resources

- Retro report for 2026-05-12 → 2026-05-13 (the session that produced
  this ticket).
- Session `2c8eccf2` — the regression case showing the fix-loop
  bottleneck.
- Session `0d5895f2` — the desired terminal-at-report behavior.
- `.claude/skills/resolve-issue-tickets/SKILL.md` — the existing
  primitive the handoff routes to.
