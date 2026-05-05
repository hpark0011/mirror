# <Feature Name> — Spec

**Created:** <YYYY-MM-DD>

## What the user gets

<2–5 bullets describing the feature from the user's perspective. No tech jargon.
This is the alignment checkpoint — if these bullets are wrong, everything below is wrong.
Example: "When I sign up with a blocked email, I see a friendly waitlist message
instead of landing in a broken account.">

## Non-goals

What this feature deliberately does NOT do, and why. Empty is not allowed — if genuinely
none, say so and justify.

- {e.g. "Does not handle SSO — gated behind workspace flag, tracked separately"}

## How we'll know it works

Each row is the source of truth for one Playwright E2E test. Write in plain language a non-engineer could follow — real user flows, not internal state checks. `Test file` may stay blank during drafting; must be set before implementation. Test conventions: `.claude/rules/verification.md` § E2E Tests.

| Scenario (user-flow language)                     | Expected outcome                                  | Test file       | Verifies |
| ------------------------------------------------- | ------------------------------------------------- | --------------- | -------- |
| {e.g. "User submits signup with a blocked email"} | {e.g. "Sees waitlist screen, no account created"} | {path or blank} | {FR-XX}  |

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

Five subsections — each answers a different question; together they prove the design is sound and compounds.

### 1. Components and structure

Where each piece lives and how they're wired — name the files, modules, key interfaces, and boundaries.

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

Trace a request or event end-to-end — trigger, state read/written, return, and trust/sync boundaries (client ↔ server, sync ↔ async, trusted ↔ untrusted). A numbered walkthrough usually beats prose.

### 3. Why this works

Why this design makes the codebase _less_ prone to failure. Address:

- What invariants does it preserve or strengthen?
- What classes of bugs does it make impossible (or much harder)?
- What existing behavior is guaranteed unchanged, and how do we know?

**Alternatives considered** — at least two options with honest tradeoffs. "Most obvious approach" doesn't count.

| Option         | Tradeoff                  | Rejected because         |
| -------------- | ------------------------- | ------------------------ |
| {alt approach} | {what we'd gain / lose}   | {the deciding constraint}|

### 4. Edge cases and gotchas

Where this architecture is fragile or surprising. Call out:

- Concurrency, race conditions, ordering assumptions
- Failure modes (network, DB, third-party) and how they degrade
- Inputs at the edge of the domain (empty, max, unicode, null, unauthorized)
- Migration / backfill / rollout risks
- Anything a future reader would curse us for not warning them about

### 5. Upstream artifact impact

Gaps this feature reveals in shared artifacts — rules, skills, templates, lints, primitives. Patch upstream before (or alongside) the downstream instance (_Always Choose the Compounding Option_, `AGENTS.md`). Empty is not allowed; if genuinely none, explicitly justify.

| Artifact | Change | Rationale                                   |
| -------- | ------ | ------------------------------------------- |
| {path}   | {what} | {why this belongs upstream, not one-off}    |

## Unit Tests

| Test File | Test Case   | Verifies |
| --------- | ----------- | -------- |
| {path}    | {test name} | {FR-XX}  |

Use Vitest. Match the owning package's existing patterns: tests in `__tests__/` with `.test.ts` suffix, or `.unit.test.ts` when the package is already configured for it. E2E coverage is captured in the `## How we'll know it works` table — don't duplicate scenarios here.

## Adversarial Review Summary

Populated by Phase 4 of the skill. Include the final stop reason (`quality bar met` or `iteration limit reached`).

| Concern   | Severity   | Resolution                             |
| --------- | ---------- | -------------------------------------- |
| {concern} | {severity} | **Accepted** / **Rejected** — {reason} |
