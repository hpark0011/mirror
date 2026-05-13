---
id: FG_207
title: "Prefer Read over cat|head for Playwright error-context files"
date: 2026-05-13
type: docs
status: completed
priority: p3
description: "Across recent dev sessions, 30-44% of Bash calls in heavy sessions are cat/head/tail/grep/find against discovered paths — most commonly Playwright's error-context.md files at test-results/<hash>/error-context.md and sub-agent task outputs at /private/tmp/claude-501/.../tasks/<id>.output. The system prompt warns against these tools for known paths but doesn't address the discovered-path case. Add a one-line guidance to verification.md so agents reach for Read on the discovered path instead of piping cat through head."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - ".claude/rules/verification.md contains a short subsection (under the e2e tests section) that explicitly states: when a Playwright run fails and reports a path like test-results/<hash>/error-context.md, prefer Read on that path over `cat <path> | head -N`."
  - "The same subsection notes the equivalent pattern for sub-agent task outputs: prefer Read on the path the harness returns, not `cat /private/tmp/.../tasks/<id>.output | tail`."
  - "Total added length is <= 8 lines of markdown — this is a cheap reminder, not a new policy section."
  - "grep -nE 'error-context\\.md|tasks/.*\\.output' .claude/rules/verification.md returns at least one occurrence — the rule names the exact filenames it's correcting."
owner_agent: "Skill/rule editor familiar with .claude/rules/ conventions and the verification protocol"
---

# Prefer Read over cat|head for Playwright error-context files

## Context

Surfaced by `/retro` on 2026-05-13 over the last 10 dev sessions.

The system prompt already says: *"Avoid using this tool to run cat,
head, tail, sed, awk, or echo commands"* and routes the agent to the
dedicated Read tool. In practice, the rule holds when reading known
paths (`Read("apps/mirror/.../foo.tsx")`) but breaks down for paths
discovered from prior tool output:

- Playwright failure paths like
  `test-results/contact-contact-tab-public-1693f-esent-content-panel-is-OPEN-chromium/error-context.md`
  are produced as Bash stdout from `pnpm test:e2e`. The natural reflex
  is `cat <discovered_path> | head -50`.
- Sub-agent outputs at
  `/private/tmp/claude-501/<project>/<session>/tasks/<id>.output` are
  reported back in the agent's return value. The reflex is `cat ... | tail -80`.

Per-session breakdown of where this happens:

| Session | Bash calls | cat/head/tail | Notable cat targets |
|---|---:|---:|---|
| `6e39b88c` (social links) | 124 | 18 | `test-results/.../error-context.md` (×4), `/private/tmp/claude-501/.../tasks/bztt6x532.output` |
| `d5a2e5e1` (review-pr) | 74 | 4 | mixed test output + workspace files |
| `2c8eccf2` (review-code) | 90 | 5 | `workspace/lessons.md` slices via `sed -n 120,170p` |

Read handles these paths directly. The only reason `head -N` exists in
those Bash invocations is to cap the output — Read accepts `limit` and
`offset` and produces the same cap with less tool overhead.

## Goal

Reading a Playwright `error-context.md` or a sub-agent `tasks/<id>.output`
file is one Read call, not one Bash call. Verification.md names both
filenames so a future agent reading the rule sees the pattern.

## Scope

- Add a short subsection to `.claude/rules/verification.md` under the
  existing "E2E Tests" section.
- Name the two specific filenames (`error-context.md` and
  `tasks/<id>.output`) so the rule grounds in the actual recurring
  patterns, not a vague principle.

## Out of Scope

- Changing the system prompt or Claude Code itself.
- Touching any skill files (`/review-code`, `/review-pr`, etc.) — those
  have their own bigger ticket (FG_206) and a smaller copy-paste of
  this rule isn't worth it.
- Restructuring verification.md tiers.

## Approach

Append ~6 lines of markdown to `.claude/rules/verification.md` under the
"E2E Tests" section. Keep it terse — this is a reminder against an
existing pattern, not a new policy area.

- **Effort:** Small (single-file ~6-line addition)
- **Risk:** Low — verification.md is referenced widely but the addition
  is additive and self-contained.

## Implementation Steps

1. Read `.claude/rules/verification.md` to find the e2e section anchor.
2. Append a "Reading test failures" subsection that names
   `error-context.md` and `/private/tmp/.../tasks/<id>.output`.
3. Re-run `wc -l .claude/rules/verification.md` to confirm the file
   gained ≤ 8 lines.

## Constraints

- No reformatting of existing verification.md content.
- The subsection name should sort naturally after the existing
  "Deterministic e2e waits" subsection.
- No mention of Read tool defaults that aren't already true (don't
  promise behaviors Claude Code doesn't have).

## Resources

- Retro report for 2026-05-12 → 2026-05-13 (the session that produced
  this ticket).
- Session `6e39b88c` — concrete cat/head examples in its Bash log.
