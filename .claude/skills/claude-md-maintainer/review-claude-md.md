---
name: review-claude-md
description: Audit an existing CLAUDE.md and suggest improvements
---

# Review CLAUDE.md

Audit the existing CLAUDE.md file and provide actionable feedback.

## Prerequisites

Read `best-practices.md` for quality metrics and anti-patterns.

## Steps

### 1. Load Context

Read:

- Existing `CLAUDE.md`
- `package.json` / `pyproject.toml` / equivalent for ground truth
- Directory structure to verify documented paths

### 2. Count Instructions

Estimate discrete instructions (statements Claude must remember and follow).

Flag:

- Warning: 50-80 instructions
- Critical: >80 instructions

### 3. Check Anti-Patterns

**Verbosity**

- Instructions that could be shorter
- Explanatory text that doesn't change behavior

**Redundancy**

- Duplicate instructions
- Rules that tooling enforces (check linter configs)
- Generic advice Claude already follows

**Staleness**

- Commands that don't exist
- Directories that don't exist
- Outdated dependencies/tools

**Missing Essentials**

- No project description
- Missing build/test/lint commands
- No structure overview (for complex projects)

**Scope Creep**

- Edge cases that belong in skills
- Domain knowledge that should be progressive
- Rarely-used workflow instructions

### 4. Verify Commands

For each command:

1. Confirm script/target exists
2. Check syntax is correct
3. Flag renamed or removed commands

### 5. Assess Token Efficiency

Estimate token count. Evaluate:

- High value: essential commands, critical warnings
- Low value: verbose explanations, obvious conventions

### 6. Generate Report

Use the review template from `best-practices.md`:

- Score (1-10) with rationale
- Issues with severity, location, and concrete fix
- Suggestions with examples
- What's working well

### 7. Offer Next Steps

After review, offer to:

1. Apply fixes automatically
2. Rewrite specific sections
3. Generate complete replacement

Show diff before any writes.
