# Workflow Rules

Claude's operational workflow — how Claude organizes and executes its own work.

Companion to `dev-process.md`, which covers Claude-developer collaboration.
`dev-process.md` governs interaction patterns; this file governs Claude's internal discipline.

## Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

> `dev-process.md` has a "Problem-Solving Flow" for developer-Claude collaboration.
> Plan Mode Default is about Claude's internal planning discipline before and during execution.

## Subagent Strategy

- Use subagents liberally to keep main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One task per subagent for focused execution.

## Self-Improvement Loop

- After ANY correction from the user: update `todos/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until mistake rate drops.
- Review lessons at session start for relevant project.

## Verification Before Done

- Never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.

## Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it.

> `dev-process.md` has "Solution Quality" covering bandaid-rejection and revert policy.
> Demand Elegance is about proactive self-review before presenting work, not reactive quality gates.

## Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.
