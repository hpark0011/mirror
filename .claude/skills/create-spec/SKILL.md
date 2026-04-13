---
name: create-spec
description: >
  Create a product spec from user requirements through multi-agent research,
  adversarial critique, and iterative refinement. Spawns PM, Adversarial Reviewer,
  domain expert (when relevant), and Verification agents in separate context windows.
  Outputs a spec with Playwright E2E tests and team orchestration plan to
  .workspace/plans/. Use when the user wants to create a spec, write requirements,
  plan a feature, or says "create spec", "spec this", "write a spec".
---

# Create Spec

Five-phase workflow: gather requirements, gather materials, create spec, adversarial critique loop, final verification. Produces a spec in `.workspace/plans/{feature-name}-spec.md`.

---

## Phase 1: Gather Requirements

1. Read the user's requirement carefully.
2. If any of these are unclear, ask before proceeding:
   - What the feature does and why it matters
   - Scope boundaries (what's in, what's out)
   - Constraints (tech stack, performance, UX)
3. Do NOT proceed to Phase 2 until requirements are unambiguous.

---

## Phase 2: Gather Materials

Run these in parallel where possible:

### 2a — Read Research Material

If the user provided or referenced research material (links, docs, prior specs), read it in full. Summarize key findings that affect design decisions.

### 2b — Investigate Codebase

Spawn a **Codebase Analyst** agent:

```
You are a Codebase Analyst. Investigate how the current codebase relates to the
feature described below and report what exists vs what needs to be built.

## Feature
{user's requirement}

## Instructions
1. Use Grep and Glob to find related files. Read key files to understand existing patterns.
2. Check package.json files for relevant dependencies.
3. Examine store slices, components, IPC handlers, and preload scripts as relevant.
4. Report:
   - Feature status: exists | partial | missing
   - Related files with brief descriptions
   - Existing architectural patterns for similar features
   - Where new code should live (packages, directories)
   - Integration points with existing code
   - Files to create and files to modify
```

### 2c — Consult Domain Expert (When Relevant)

Check `.claude/agents/` for a domain expert agent whose description matches the feature's domain:

| Agent                   | Domain                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `agent-stream-pipeline` | Streaming, chunk processing, token buffering, backpressure       |
| `auth-layer`            | OAuth, API keys, token storage, auth state, credential injection |
| `release`               | Packaging, CI, code signing, auto-updater, versioning            |

If the feature touches one of these domains, spawn that agent with the user's requirement and ask it to:

1. Review the proposed feature for domain-specific concerns
2. Identify constraints, gotchas, or patterns that must be followed
3. Flag risks or conflicts with existing domain architecture

If no domain expert applies, skip this step.

---

## Phase 3: Create Spec

Spawn a **PM Agent**:

```
You are a PM Agent. Create a product spec based on the user's requirement,
codebase analysis, and domain expert input (if any).

## User's Requirement
{paste requirement}

## Codebase Analysis
{paste codebase analyst output}

## Domain Expert Input (if any)
{paste domain expert output, or "N/A"}

## Instructions
Write the spec as markdown. Every requirement MUST have a hard, automatable
verification criterion — no subjective criteria.

## Required Sections

### Overview
What the feature does, why it matters (2-3 sentences).

### Requirements
#### Functional Requirements
| ID | Requirement | Priority | Verification |
|----|-------------|----------|--------------|
| FR-01 | {requirement} | {p0-p3} | {exact check} |

#### Non-functional Requirements (if any)
Same table format.

### Architecture
- Component design: where each piece lives, data flow, key interfaces
- Files to create (table: file | purpose)
- Files to modify (table: file | change)
- Dependencies to add (if any)

### Unit Tests
| Test File | Test Case | Verifies |
|-----------|-----------|----------|
| {path} | {test name} | {FR-XX} |

Use bun:test, test() not it(), .test.ts suffix, __tests__/ directory.

### Playwright E2E Tests
| Test File | Scenario | Verifies |
|-----------|----------|----------|
| {path} | {user flow from user's perspective} | {FR-XX} |

E2E tests go in e2e/ at project root, use .spec.ts suffix.
Tests must describe real user flows, not internal state checks.

### Anti-patterns to Avoid
Specific things NOT to do, with reasons.

### Team Orchestration Plan
Plan which agents execute the implementation work.
- Check .claude/agents/ for domain expert agents that can own specific steps.
- Prefer existing specialized agents over creating new ones.
- For small features (< 5 files), a single implementation agent is fine.
- For larger features, break into steps with clear ownership:
  Step N — {description}
  Agent: {agent name or "general"}
  Tasks: {numbered list}
  Verification: {what to check before moving on}

### Open Questions (if any)
Anything that needs user input before implementation.
```

---

## Phase 4: Adversarial Critique Loop

After the PM Agent produces the spec, spawn **two agents in parallel** (three if a domain expert was consulted in Phase 2):

### Agent 1: Adversarial Spec Reviewer

```
You are an Adversarial Spec Reviewer. You challenge plans by trying to falsify
them. Where other reviewers evaluate whether a document is clear or feasible,
you ask whether it's RIGHT — whether the premises hold, the assumptions are
warranted, and the decisions would survive contact with reality.

You construct counterarguments, not checklists.

If you spot any part of the spec that is a band-aid solution over a solution
that makes the wrong thing structurally hard to do, call it out. The
architecture should prevent mistakes, not just handle them.

## User's Requirement
{paste requirement}

## Spec
{paste spec content}

## Instructions
For each concern, provide:
- Severity: Critical | Important | Minor
- The specific problem
- Why it matters (what breaks, what's fragile, what's wrong)
- Your proposed fix

Focus on:
1. Assumptions that might not hold
2. Edge cases the spec doesn't address
3. Architectural decisions that will cause pain later
4. Requirements that are undertested or have weak verification
5. Band-aid solutions where structural prevention is possible
6. Missing failure modes
```

### Agent 2: Domain Expert (if consulted in Phase 2)

Re-spawn the same domain expert agent from Phase 2 with the full spec, asking it to review for domain-specific correctness, missed constraints, and compatibility with existing domain architecture.

### After critique completes:

1. Evaluate each concern. Not all feedback is valid — reject concerns that contradict the user's explicit requirements.
2. For accepted concerns: update the spec.
3. If significant changes were made (any Critical or 2+ Important concerns accepted), re-run the adversarial reviewer on the updated spec.
4. Iterate until the adversarial reviewer returns no Critical concerns and no more than 1 Important concern.
5. Record the critique results in an **Adversarial Review Summary** table at the bottom of the spec:

| Concern   | Severity   | Resolution                             |
| --------- | ---------- | -------------------------------------- |
| {concern} | {severity} | **Accepted** / **Rejected** — {reason} |

---

## Phase 5: Final Verification

Spawn a **Verification Agent**:

```
You are a Verification Agent. Verify the final spec is complete and correct.

## User's Original Requirement
{paste requirement}

## Final Spec
{paste spec content}

## Checklist — report PASS or FAIL for each:
1. Requirements coverage: Does every user requirement have a corresponding FR/NFR?
2. Test coverage: Does every FR have at least one unit test AND one E2E test?
3. E2E tests are user-perspective: Do Playwright tests describe user flows, not internal state?
4. Team orchestration plan exists and references real agents from .claude/agents/ where applicable
5. Verification criteria: Every requirement has a concrete, automatable check (no "looks good")
6. Codebase alignment: File paths and package locations match actual codebase structure
7. Anti-patterns section exists with specific items

## Output
For each item: PASS/FAIL with details.
If any FAIL: list the specific fix needed.
```

If the Verification Agent finds failures, fix them in the spec. Re-verify only the failed items.

---

## Final Output

1. Write the spec to `.workspace/plans/{feature-name}-spec.md`
2. Present a summary:

```
## Spec Complete

**Location:** .workspace/plans/{feature-name}-spec.md

### Requirements
- {N} functional + {N} non-functional requirements

### Test Plan
- {N} unit tests + {N} E2E tests

### Orchestration
- {summary of who does what}

### Adversarial Review
- {N} concerns raised, {N} accepted, {N} rejected
- No unresolved Critical concerns

### Verification
- All checks PASS
```

---

## Rules

- **Minimum 3 sub-agents**: PM Agent, Adversarial Spec Reviewer, Verification Agent. Each gets its own context window via the Agent tool.
- **Domain expert is additive**: When a domain expert is consulted, it adds a 4th agent (used in Phase 2 and Phase 4).
- **Hard verification only**: Every requirement must have a concrete, automatable check.
- **Codebase accuracy**: File paths in the spec must be verified against the real codebase. Do not guess.
- **Spec output**: `.workspace/plans/{feature-name}-spec.md`, kebab-case filename.
- **Iterate critiques**: The adversarial loop runs until no Critical concerns remain.
- **User requirements are sovereign**: If the adversarial reviewer argues against something the user explicitly requested, reject it and document why.
