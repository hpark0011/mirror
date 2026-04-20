# <Feature Name> — Spec

_Template artifact. Consumed by `.claude/skills/create-spec/SKILL.md` (Phase 3).
Do NOT reference this file directly from an agent — go through the skill._

---

## What the user gets

<2–5 bullets describing the feature from the user's perspective. No tech jargon.
This is the alignment checkpoint — if these bullets are wrong, everything below is wrong.
Example: "When I sign up with a blocked email, I see a friendly waitlist message
instead of landing in a broken account.">

## How we'll know it works

User-flow scenarios that prove the feature works. Each row is the source of truth for one Playwright E2E test — write the scenario in plain language a non-engineer could follow, then fill in the test file path before orchestration. `Test file` may stay blank during drafting; it must be set before the orchestration plan runs.

E2E tests live in the owning app's Playwright directory (e.g., `apps/mirror/e2e/`) with a `.spec.ts` suffix. Use the Playwright CLI only (`.claude/rules/testing.md`). Tests must describe real user flows, not internal state checks.

| Scenario (user-flow language)                     | Expected outcome                                  | Test file        | Verifies |
| ------------------------------------------------- | ------------------------------------------------- | ---------------- | -------- |
| {e.g. "User submits signup with a blocked email"} | {e.g. "Sees waitlist screen, no account created"} | {path or blank}  | {FR-XX}  |

## Requirements

### Functional Requirements

| ID    | Requirement   | Priority | Verification            |
| ----- | ------------- | -------- | ----------------------- |
| FR-01 | {requirement} | {p0-p3}  | {concrete, automatable} |

### Non-functional Requirements (if any)

| ID     | Requirement   | Priority | Verification            |
| ------ | ------------- | -------- | ----------------------- |
| NFR-01 | {requirement} | {p0-p3}  | {concrete, automatable} |

## Architecture

Break the architecture down into the four sections below. Do not collapse them —
each answers a different question and together they prove the design is sound.

### 1. Components and structure

Where each piece lives, what it owns, and how the pieces are wired together.
Name the files, the modules, the key interfaces, and the boundaries between them.

- Files to create:

| File   | Purpose |
| ------ | ------- |
| {path} | {what}  |

- Files to modify:

| File   | Change |
| ------ | ------ |
| {path} | {what} |

- Dependencies to add (if any)

### 2. How data flows

The underlying mechanism. Trace a request or event end-to-end: what triggers it,
what state it reads, what state it writes, what it returns, and where the
boundaries are (client ↔ server, sync ↔ async, trusted ↔ untrusted). A sequence
or numbered walkthrough is usually clearer than prose.

### 3. Why this works

Why this design improves the system without introducing regressions, and why it
makes the codebase *less* prone to failure. Address:

- What invariants does it preserve or strengthen?
- What classes of bugs does it make impossible (or much harder)?
- What existing behavior is guaranteed unchanged, and how do we know?
- Why this approach over the obvious alternatives?

### 4. Edge cases and gotchas

Where this architecture is fragile or surprising. Call out:

- Concurrency, race conditions, ordering assumptions
- Failure modes (network, DB, third-party) and how they degrade
- Inputs at the edge of the domain (empty, max, unicode, null, unauthorized)
- Migration / backfill / rollout risks
- Anything a future reader would curse us for not warning them about

## Unit Tests

| Test File | Test Case   | Verifies |
| --------- | ----------- | -------- |
| {path}    | {test name} | {FR-XX}  |

Use Vitest. Match the owning package's existing patterns: tests in `__tests__/` with `.test.ts` suffix, or `.unit.test.ts` when the package is already configured for it. E2E coverage is captured in the `## How we'll know it works` table — don't duplicate scenarios here.

## Team Orchestration Plan

Reviewer selection and wave packaging happen at execution time — see `.claude/skills/orchestrate-implementation/SKILL.md`. This plan lists logical work chunks with hard gates; it does not pre-assign critics. The spec describes *what must be true*; orchestration decides *who reviews*.

Plan which agents execute the implementation work. Check `.claude/agents/` for specialized agents that can own specific steps. Prefer existing specialized agents over creating new ones.

```
Step N — {description}
Suggested executor: {agent name from .claude/agents/, or "general"}
Scope: {files touched, what changes}
Hard gate: {exact shell command(s) that must exit 0 before this step is done}
Verifies: {FR-XX, FR-YY}
```

## Open Questions (if any)

<Anything that needs user input before implementation.>

## Adversarial Review Summary

Populated by Phase 4 of the skill. Include the final stop reason (`quality bar met` or `iteration limit reached`).

| Concern   | Severity   | Resolution                             |
| --------- | ---------- | -------------------------------------- |
| {concern} | {severity} | **Accepted** / **Rejected** — {reason} |
