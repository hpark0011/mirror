---
name: generate-issue-tickets
description: >
  Generate structured issue ticket markdown files with strict frontmatter contract in workspace/tickets/to-do.
  Use when the user describes a bug, feature request, refactoring task, break down a plan, or
  any work item that needs to be tracked. Invoke with /generate-issue-tickets
  or when the user says "create a ticket", "file an issue",
  "track this", or describes work that should become a ticket.
argument-hint: "[description of work item or 'break down' a plan]"
allowed-tools: Read, Grep, Glob, Write, Edit, Bash(ls *), Bash(find *)
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: ".claude/skills/generate-issue-tickets/scripts/run-validate.sh"
          timeout: 30
---

# Generate Issue Tickets

Create issue ticket markdown files in `workspace/tickets/to-do` following a strict frontmatter contract.

## Directory Structure

```
workspace/tickets/
├── to-do/          # Prioritized and ready to be picked up
├── completed/      # Resolved and verified
└── canceled/       # Won't fix / no longer relevant
```

Ticket status is encoded in **two places** that must stay in sync:

1. The `status` field in YAML frontmatter
2. The directory the file lives in

To transition a ticket: move the file to the new directory and update `status` in frontmatter.

## Frontmatter Contract

Every ticket must conform to this contract. All required fields must be present and valid.

| Field                 | Type           | Required | Validation                                                     |
| --------------------- | -------------- | -------- | -------------------------------------------------------------- |
| `id`                  | string         | yes      | Format `FG_NNN` (3-digit zero-padded)                          |
| `title`               | string         | yes      | Max 80 chars                                                   |
| `date`                | string         | yes      | `YYYY-MM-DD` format, today's date at creation                  |
| `type`                | enum           | yes      | One of: feature, fix, improvement, chore, docs, refactor, perf |
| `status`              | enum           | yes      | Must be `to-do` on creation                                    |
| `priority`            | enum           | yes      | One of: p0, p1, p2, p3                                         |
| `description`         | string         | yes      | Min 10 words                                                   |
| `dependencies`        | list\<string\> | yes      | List of `FG_NNN` IDs (can be empty `[]`)                       |
| `acceptance_criteria` | list\<string\> | yes      | 2-7 deterministic/verifiable criteria (see below)              |
| `parent_plan_id`      | string         | no       | Add only when the ticket was derived from a plan file          |

## Workflow

1. **Scope + investigate.** Understand the request, read relevant files (verify paths — don't guess), and scan `workspace/tickets/` for the highest `FG_NNN` to determine the next ID. Default priority to p2 if unclear.
2. **Generate.** Write to `workspace/tickets/to-do/FG_{NNN}-{priority}-{slug}.md` using [template.md](template.md). One outcome per ticket; decompose if too broad.
3. **Validate.** The PostToolUse hook runs the validator automatically. Fix any errors and re-save.
4. **Report.** Filename + one-line summary.

## Priority Rubric

| Priority | Criteria                                                     | Examples                                      |
| -------- | ------------------------------------------------------------ | --------------------------------------------- |
| p0       | Needs immediate attention — production down, security breach | Site crash, data leak, auth completely broken |
| p1       | Merge blocking — must fix before next release                | Broken build, failing CI, critical regression |
| p2       | Not merge blocking but needs to be fixed                     | Missing validation, race condition, tech debt |
| p3       | Improvements — nice to have                                  | Unused import, naming cleanup, minor refactor |

## Type Enum

| Type          | When to use                                |
| ------------- | ------------------------------------------ |
| `feature`     | New functionality                          |
| `fix`         | Something is broken                        |
| `improvement` | Improve existing feature                   |
| `chore`       | Maintenance (deps update, config, CI)      |
| `docs`        | Documentation changes                      |
| `refactor`    | Code improvement without changing behavior |
| `perf`        | Performance optimization                   |

## Naming Convention

Filename: `FG_{NNN}-{priority}-{slug}.md`

- `FG_NNN`: Zero-padded 3-digit issue ID (e.g., `FG_001`)
- `priority`: `p0`, `p1`, `p2`, or `p3`
- `slug`: Kebab-case summary, max 6 words

The filename stays the same across status transitions — only the directory changes.

## Acceptance Criteria

Each criterion must be **deterministic** (pass/fail with zero ambiguity) and **concrete** (reference specific commands, greps, file checks, or build commands). Include at least one positive check and one negative check. Use grep, file existence, build/lint/test commands, or pattern matches.

If a behavioral check can't be deterministic, note it under `## Manual Verification` in the body.

## Rules

- **One ticket per issue.** Don't combine unrelated problems.
- **One outcome per title.** If the goal contains "and" connecting independent outcomes, split into separate tickets.
- **Titles describe outcomes, not steps.** BAD: "Add auth check." GOOD: "Admin routes reject unauthenticated requests."
- **Verify file paths.** Every path in Context must come from a Read/Grep, not from memory.
- **Implementation Steps belong in every ticket.** 3-8 ordered, independently-verifiable steps with file paths or commands. Fewer = underspecified; more = decompose.
- **Optional body sections.** `## Out of Scope`, `## Constraints`, `## Resources`, `## Manual Verification` are opt-in — include them only when there's real content. Empty placeholders are not better than no section. (Past data: those four sections were empty or near-empty in 39–48% of tickets when they were mandatory.)
- **Batch creation.** When generating multiple tickets, determine all IDs upfront, write all, let the validator hook run on each, then report a single summary table.
