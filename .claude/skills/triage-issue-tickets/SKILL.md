---
name: triage-issue-tickets
description: Triage tickets in workspace/tickets/to-do/ — cancel irrelevant ones, mark already-solved ones completed. Use when the user says "triage tickets", "clean up the backlog", "/triage-issue-tickets". Does NOT resolve open tickets (use resolve-issue-tickets).
---

## Workflow

1. Read each ticket in `workspace/tickets/to-do/`.
2. For each, decide whether it's still relevant given current codebase state, and whether the work has already been done.
3. Triage per below.

## Triaging

For each ticket, set the `status:` frontmatter field and move the file:

- **Irrelevant** (premise no longer holds, superseded, duplicate) → `status: canceled`, move to `workspace/tickets/canceled/`.
- **Already solved** (verify by reading the affected files, not just `git log`) → `status: completed`, move to `workspace/tickets/completed/`.
- **Otherwise** → leave in `to-do/`.
