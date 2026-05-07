# Dev Process Guidelines

Repo-specific workflow rules. Keep this file tight — generic coding-agent hygiene
belongs in the system prompt, not here.

## Session Discipline

- **One focused outcome per session.** Commit progress and start fresh for the next piece.
- **State the branch and plan file** at session start if they exist.
- **Hard ceiling: ~150 turns.** Checkpoint-commit and continue fresh before quality degrades.

## Planning

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately.

## Problem-Solving Flow

1. Developer describes the problem (often with their own analysis).
2. Claude investigates and states hypothesis — compare with developer's thinking.
3. Align on approach before touching code.
4. Implement from a plan — not ad-hoc.
5. Verify — follow `.claude/rules/verification.md` protocol. Do not skip.

## Debugging UI/Visual Bugs

- **Observe before coding.** Use Chrome MCP to screenshot/inspect live behavior before writing a fix.
- **State hypothesis before implementation.**
- Anti-patterns (setTimeout for timing, etc.) live in `.claude/rules/react-components.md`.

## Solution Quality

- **Reject bandaid fixes.** If the fix doesn't address root cause, don't ship it.
- **One revert = rethink.** Step back and re-investigate rather than iterating on the same approach.
- **Prefer the developer's architectural instinct** — they know the codebase deeply.
- Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness.

## Self-Improvement

- After ANY correction from the user: update `workspace/lessons.md` with the pattern.
- Review lessons at session start for the relevant project.

## Task Management

- Drive work through `workspace/tickets/` using the `generate-issue-tickets` skill.
- Document debugging learnings early in `workspace/lessons.md`.
