---
name: create-plan
description: Create a step-by-step implementation plan from a requirement. Outputs to workspace/plans/ with a Playwright CLI hard-verification step. Use when the user says "plan this", "write a plan", or hands you a requirement to plan before building.
---

## Workflow

1. Read the requirement. Ask clarifying questions only if genuinely ambiguous.
2. Research the current state — what exists, what needs to change.
3. Write the plan to `workspace/plans/{YYYY-MM-DD}-{feature-name}-plan.md`
   - `{YYYY-MM-DD}` = today's date
   - `{feature-name}` = kebab-case slug
4. The plan MUST include:
   - **Hard verification**: a Playwright CLI test path + assertions (per `.claude/rules/verification.md` § E2E Tests). Chrome MCP is for visual confirmation only, not test assertions.
   - **Implementation steps** in order.
   - **Constraints & non-goals**.
