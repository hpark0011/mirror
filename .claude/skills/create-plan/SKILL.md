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
4. The plan file MUST start with this YAML frontmatter block — no other format, and do NOT also restate these fields as inline `**Date:**` / `**Branch:**` / `**Owner:**` lines under the H1:

   ```markdown
   ---
   date: {YYYY-MM-DD}            # today's date, same as the filename prefix
   branch: {current-branch}      # output of `git rev-parse --abbrev-ref HEAD`
   owner: {git-user-name}        # output of `git config user.name`
   ---

   # {Plan title}
   ```

   Resolve `branch` and `owner` from git, not from memory. If either command fails, ask the user before writing the file.
5. The plan body MUST include:
   - **Hard verification**: a Playwright CLI test path + assertions (per `.claude/rules/verification.md` § E2E Tests). Chrome MCP is for visual confirmation only, not test assertions.
   - **Implementation steps** in order.
   - **Constraints & non-goals**.
6. After writing the file, invoke the `greyboard-markdown` skill with the plan's absolute path to open it in the Greyboard desktop app.
