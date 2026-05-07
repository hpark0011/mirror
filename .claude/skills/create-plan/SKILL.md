---
name: create-plan
description: Create a step-by-step implementation plan from a requirement. Outputs to workspace/plans/ with a Playwright CLI hard-verification step. Use when the user says "plan this", "write a plan", or hands you a requirement to plan before building.
---

## Workflow

1. Read the requirement. Ask clarifying questions only if genuinely ambiguous.
2. Research the current state — what exists, what needs to change.
3. Write the plan to `workspace/plans/{YYYY-MM-DD}-{feature-name}-plan.md`
   - `{YYYY-MM-DD}` = today's date
   - `{feature-name}` = kebab-case slug (matches `slug:` in frontmatter)
4. The plan MUST start with the YAML frontmatter contract (see below).
5. The plan MUST include:
   - **Hard verification**: a Playwright CLI test path + assertions (per `.claude/rules/verification.md` § E2E Tests). Chrome MCP is for visual confirmation only, not test assertions.
   - **Implementation steps** in order.
   - **Constraints & non-goals**.
6. After writing the file, invoke the `greyboard-markdown` skill with the plan's absolute path to open it in the Greyboard desktop app.

## Frontmatter contract

Every plan starts with YAML frontmatter. Required fields are always present;
optional fields are added only when the relationship exists.

```yaml
---
# Required
id: PLAN_NNN                    # next free number; tickets reference this via parent_plan_id
slug: feature-name-kebab        # matches the filename suffix
title: "One-line title (no leading 'Plan:' prefix)"
date: YYYY-MM-DD                # today, matches filename date
type: feature                   # feature | fix | refactor | chore | migration | docs
status: draft                   # draft | active | completed | superseded | blocked
branch: feature-name            # git branch this plan ships on
worktree: .worktrees/feature-name/   # absolute-from-repo-root path, or null if no worktree
scope: "One-sentence scope summary."

# Standard — drives the verification automation
apps: [mirror]                  # subset of: mirror, ui-factory
verification_tier: 5            # 1-5 per .claude/rules/verification.md

# Optional — include only when the relationship exists
predecessor: PLAN_NNN           # this plan depends on / unblocks another plan
successor: PLAN_NNN             # another plan picks up after this lands
tickets: [FG_NNN, FG_NNN]       # tickets generated from this plan
---
```

### Field rules

- **`id`** — `PLAN_NNN`, three-digit zero-padded, allocated sequentially across `workspace/plans/`. The id only lives inside each plan's frontmatter (filenames are date/slug-based), so scan file contents to find the highest in use: `grep -hE '^id: PLAN_[0-9]+' workspace/plans/*.md | sort -V | tail -1`.
- **`status`** — start at `draft`; flip to `active` when the branch starts; `completed` when merged; `superseded` when a later plan replaces this one (link the replacement in body); `blocked` only when an external constraint stops progress.
- **`type`** — pick the verb that matches the dominant change: `feature` (new capability), `fix` (bug), `refactor` (no behavior change), `chore` (tooling/deps), `migration` (schema/data), `docs` (doc-only).
- **`apps` / `packages`** — agents derive the right `pnpm build --filter=...` from these (per `.claude/rules/verification.md` § App Filter Reference). Omit the field entirely when empty (e.g., a mirror-only plan has `apps: [mirror]` and no `packages` key at all).
- **`verification_tier`** — 1 (types/utils), 2 (component structure), 3 (CSS/visual), 4 (event handlers), 5 (new feature E2E). Plans introducing UI almost always 4 or 5.
- **`worktree`** — set to `null` (not omitted) if no worktree was created. Worktree-discipline rule (`.claude/rules/worktrees.md`) requires sub-agents to use this exact path for every Edit/Write.
- **H1 below frontmatter** — omit. The `title:` field is the canonical title; an H1 duplicates it. Body starts with the first `## Section`.
