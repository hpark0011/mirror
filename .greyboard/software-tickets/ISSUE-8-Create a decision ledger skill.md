---
version: 1
id: ISSUE-8
title: Create a decision ledger skill
status: in_progress
priority: none
assignee: null
agentExecution: null
sortOrder: 65529.5
labels: []
blockedBy: []
parentId: null
projectId: null
worktree:
  enabled: true
  baseRef: main
createdBy: user
updatedBy: user
createdAt: 2026-08-03T05:04:46.840Z
updatedAt: 2026-08-03T09:59:17.487Z
completedAt: null
---
## Description

From user's requirement, fill out the decision ledger. This decision ledger should be used as a source of truth when planning, reviewing, refactoring.

## Purpose of the decision ledger

The purpose to make the followings clear and prevent from architectural drift that could cause scattered responsibilities and hidden couplings. 

- what decisions exist

- which facts those decisions depend on

- where policy is defined

- where invariants are enforced

- how decisions are projected and presented

- where ownership is missing, duplicated, or weak.

## Write

1\) Business requirement: Turn user's intent into clear business requirement. If the intent needs clarification, ask user questions to clear it up.

2\) Decisions: Create an exhaustive list of decisions that is needed to serve the business requirement. Each decision should have one home.

3\) Authoritative facts: List all the facts that each decisions depend on.

4\) Invariants: List all the invariants that must never become false.

5\) Policies: how the system decides what should happen.

6\) Enforcements: the mechanism that prevents or rejects violations.

7\) Presentation: Presentation determines how the resolved state is communicated to the user.

8\) Projection: Projection converts authoritative state into a form another process, store, or surface can consume.

9\) Verification: How to verify policy, enforcement, presentation, and projection.

&nbsp;

&nbsp;

- **Requirement:** what the product needs.
- **Policy:** how the system decides what should happen.
- **Invariant:** what must never become false.
- **Enforcement:** the mechanism that prevents or rejects violations.