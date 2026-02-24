# Dev Process Guidelines

Rules for how Claude and the developer work together, and Claude's internal discipline.

## Session Discipline

- **One focused outcome per session.** Commit progress and start fresh for the next piece.
- **State the branch and plan file** at session start if they exist.
- **Hard ceiling: ~150 turns.** Checkpoint-commit and continue fresh before quality degrades.

## Tool Discipline

- **Never use Bash for file reading or searching.** Use `Read` instead of `cat`/`head`/`tail`, `Grep` instead of `grep`/`rg`, `Glob` instead of `find`/`ls`.

## Planning

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately.

## Subagent Strategy

- Use subagents liberally to keep main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- One task per subagent for focused execution.

## Problem-Solving Flow

1. **Developer describes the problem** (often with their own analysis)
2. **Claude investigates and states hypothesis** — compare with developer's thinking
3. **Align on approach** before touching code
4. **Implement from a plan** — not ad-hoc
5. **Verify** — browser check, build, or test

## Debugging UI/Visual Bugs

- **Observe before coding.** Use Chrome MCP to screenshot/inspect live behavior before writing a fix.
- **State hypothesis before implementation.**
- **Never use setTimeout to fix visual timing issues.** Find the architectural root cause.
- Limit agent orchestration for UI bugs — 1-2 focused agents max.

## Solution Quality

- **Reject bandaid fixes.** If the fix doesn't address root cause, don't ship it.
- **One revert = rethink.** Step back and re-investigate rather than iterating on the same approach.
- **Prefer the developer's architectural instinct** — they know the codebase deeply.
- Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness.

## Self-Improvement

- After ANY correction from the user: update `workspace/lessons.md` with the pattern.
- Review lessons at session start for relevant project.

## Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.

## Task Management

- Drive work through `workspace/tickets/` using the `generate-issue-tickets` skill.
- Document learnings from debugging sessions early in `workspace/lessons.md`.
