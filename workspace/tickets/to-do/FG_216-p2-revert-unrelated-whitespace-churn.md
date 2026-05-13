---
id: FG_216
title: "Revert unrelated whitespace churn bundled into the configuration-mode PR"
date: 2026-05-13
type: chore
status: to-do
priority: p2
description: "PR #93 includes cosmetic reformatting unrelated to the configuration-mode feature — cn() call collapse in chat-input.tsx and scheduler.runAfter() reformatting in chat/mutations.ts. These changes pollute git blame, hide on a feature commit, and violate the project's PR-hygiene lesson from 2026-05-06."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "git diff main...HEAD -- apps/mirror/features/chat/components/chat-input.tsx shows no cn() reformatting unrelated to the configuration-mode change"
  - "git diff main...HEAD -- packages/convex/convex/chat/mutations.ts shows the scheduler.runAfter() formatting unchanged from main for the unmodified call sites (the new mode-branch reformat may stay if it is integral to the new logic)"
  - "If the formatting is intentional and project-wide, a separate PR lands the reformatting with prettier/eslint-formatter so blame credits the formatter, not a feature commit"
  - "pnpm --filter=@feel-good/mirror lint passes with no new warnings"
owner_agent: "Code hygiene engineer"
---

# Revert unrelated whitespace churn bundled into the configuration-mode PR

## Context

The maintainability reviewer identified two cosmetic-only changes in PR #93 unrelated to the configuration-mode feature:

1. **`apps/mirror/features/chat/components/chat-input.tsx:99-103`** — `cn("justify-end", "[&>kbd]:rounded-full", "px-2.5 pb-2.5")` collapsed from four lines to one. No semantic change. No relation to the new `mode` prop being added in the same file.

2. **`packages/convex/convex/chat/mutations.ts:283-291,395-401`** — Two `scheduler.runAfter()` calls reformatted from multi-line to inline. The call sites themselves are unchanged (same arguments, same scheduler call). No relation to the new mode-branching logic in the same file.

`workspace/lessons.md` (2026-05-06 entry) calls out this pattern:

> Cosmetic/visual tweaks must ship in their own commit and PR. Bundling them into a feature commit makes `git blame` point at a feature when the line was actually reformatted; reviewers waste time confirming the line didn't change behavior.

## Goal

`git blame` on each reformatted line points at a commit whose intent is "format" — not "Add profile configuration helper agent."

## Scope

- `apps/mirror/features/chat/components/chat-input.tsx` — revert the `cn()` line-collapse.
- `packages/convex/convex/chat/mutations.ts` — revert the two `scheduler.runAfter()` reformats at call sites that did not otherwise change.
- If a project-wide prettier/eslint config-bump motivated the formatting, land it as a separate PR.

## Out of Scope

- Any actual logic in `chat-input.tsx` or `chat/mutations.ts` (e.g., the new `mode` prop, the new `existingMode !== mode` check) — those stay.
- Other unrelated reformatting (none was flagged).

## Approach

Read each flagged line range, revert the formatting to match `main`, and re-run lint to confirm the formatter doesn't immediately re-collapse it.

If `pnpm lint` keeps reformatting these lines, that signals a project-wide formatter change motivated the churn — in which case land the formatter change separately rather than bundling it into a feature PR.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. `git diff main -- apps/mirror/features/chat/components/chat-input.tsx packages/convex/convex/chat/mutations.ts` — confirm the exact ranges to revert.
2. Restore the multi-line `cn()` formatting in chat-input.tsx (matching the `main` shape at the corresponding hunk).
3. Restore the multi-line `scheduler.runAfter(0, ..., { ... })` formatting in mutations.ts for the two call sites that did not change semantically.
4. Run `pnpm --filter=@feel-good/mirror lint`. If lint reformats them back, that means a config bump silently changed prettier rules — open a follow-up to land the prettier config change separately.

## Constraints

- This is a deletion-of-churn ticket. No new code. No behavior change.
- Do not "fix" any other formatting in the same commit.

## Resources

- PR #93 maintainability review: `unrequested-whitespace-churn-chat-input`, `unrequested-whitespace-churn-mutations`
- `workspace/lessons.md` 2026-05-06 entry on PR hygiene
