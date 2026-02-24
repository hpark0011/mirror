---
id: FG_026
title: "Add deterministic parity verification script"
date: 2026-02-24
type: chore
status: to-do
priority: p2
description: "Add a single deterministic verification script that checks core wiring, route usage, and build/typecheck gates for web and desktop parity."
dependencies: ["FG_020", "FG_023", "FG_024", "FG_025"]
parent_plan_id: "2026-02-24-greyboard-desktop-web-parity-plan"
acceptance_criteria:
  - "`test -f scripts/verify-greyboard-parity.mjs` exits 0"
  - "`node scripts/verify-greyboard-parity.mjs` exits 0"
  - "`node scripts/verify-greyboard-parity.mjs | rg -n 'PASS'` returns at least 5 matches"
  - "`rg -n 'verify-greyboard-parity' package.json` returns a match for an npm script entry"
owner_agent: "Validation Harness Agent"
---

# Add deterministic parity verification script

## Context

The parity project spans many files and both apps; deterministic, repeatable validation is required to prevent drift.

## Goal

Create one command that deterministically verifies parity wiring and build gates.

## Scope

- Add verification script in `scripts/`
- Add npm script alias in root `package.json`
- Include hard checks for:
  - shared package usage
  - route migration completion
  - build/typecheck command success

## Out of Scope

- End-to-end visual/UI parity tests
- Performance benchmarks

## Approach

Encode command checks in one script with explicit PASS/FAIL output and non-zero exit on failure.

## Constraints

- Must be deterministic in local CI-like environments
- No network dependency

## Resources

- `docs/plans/2026-02-24-greyboard-desktop-web-parity-plan.md`
- `workspace/tickets/to-do/FG_014-p1-scaffold-greyboard-core-package.md`

