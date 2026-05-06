---
name: resolve-issue-tickets
description: Resolves issue tickets in workspace/tickets/to-do/ by orchestrating an execution agent and a separate verification agent with a feedback loop. Marks status: completed and moves the file to workspace/tickets/completed/. Use when the user says "resolve tickets", "work through tickets", "/resolve-issue-tickets". Does NOT create tickets (use generate-issue-tickets) or triage them (use triage-issue-tickets).
---

## Workflow

1. Check issue tickets that need to be done in `workspace/tickets/to-do/`.
2. Orchestrate the agents below to do these tasks.
3. When a ticket is resolved, set its `status:` frontmatter field to `completed` and move the file to `workspace/tickets/completed/`.

## Agents

1. **Execution agent** — Reads the issue ticket, implements the requirements.
2. **Verification agent** — Evaluates the execution agent's work against the ticket's verification list (its `acceptance_criteria`) and provides feedback.

## Orchestration requirements

- Each task must be hard verified.
- Execution and verification are separate roles. The execution agent must not do its own verification.
- After the execution agent finishes, the verification agent provides feedback. The execution agent resolves the feedback. Repeat until all hard verification criteria pass.
