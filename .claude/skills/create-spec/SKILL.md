---
name: create-spec
description: Create a product spec from user requirements through multi-agent research, adversarial critique, and iterative refinement. Spawns PM, Adversarial Reviewer, domain expert (when relevant), and Verification agents in separate context windows. Outputs a spec with Playwright E2E tests and team orchestration plan to workspace/spec/. Use when the user wants to create a spec, write requirements, plan a feature, or says "create spec", "spec this", "write a spec".
---

# Create Spec

## When to use

- User says "create a spec", "spec this", "write a spec", "write requirements", or "plan a feature" for a non-trivial piece of work.
- A feature is large enough that it needs FR/NFR tables, test plans, and an orchestration plan before implementation starts.
- A brainstorm or ticket is ready to be hardened into a verifiable, testable spec.

**Do NOT use for**: ad-hoc notes, one-file bug fixes, quick refactors, or exploratory brainstorms (use `compound-engineering:ce-brainstorm` instead). Do not use to edit an existing spec's prose — only to author or rewrite one from requirements.

## Quick start

1. Confirm the requirement is unambiguous (Phase 1). If not, ask clarifying questions before spawning any agents.
2. Gather materials in parallel: read provided research, spawn the Codebase Analyst, and (if the domain matches) consult a domain expert (Phase 2).
3. Instantiate `spec-template/spec.md` into `workspace/spec/{feature-name}-spec.md` with hard-verification requirements and real test paths (Phase 3).
4. Run the adversarial critique loop until no Critical concerns remain (Phase 4).
5. Spawn the Verification Agent; fix any failures; write the final spec and summary (Phase 5).

## Workflow

Invariants that apply across all phases:

- **Minimum 3 sub-agents**: PM Agent, Adversarial Spec Reviewer, Verification Agent. Each gets its own context window via the Agent tool.
- **Domain expert is additive**: when consulted, it adds a 4th agent used in both Phase 2 and Phase 4.
- **Hard verification only**: every requirement row must have a concrete, automatable check.
- **Codebase accuracy**: every file path in the spec must be verified against the real codebase.
- **User requirements are sovereign**: if the adversarial reviewer argues against something the user explicitly requested, reject it and document why.
- **One-directional dependency**: `spec-template/` + `agents/` ← `SKILL.md` ← caller. This skill does not name its executor — the invoking agent owns Phase 3 routing.

### Phase 1: Gather Requirements

1. Read the user's requirement carefully.
2. If any of these are unclear, ask before proceeding:
   - What the feature does and why it matters
   - Scope boundaries (what's in, what's out)
   - Constraints (tech stack, performance, UX)
3. Do NOT proceed to Phase 2 until requirements are unambiguous.

### Phase 2: Gather Materials

Run these in parallel where possible.

**2a — Read research material.** If the user provided or referenced research material (links, docs, prior specs), read it in full. Summarize key findings that affect design decisions.

**2b — Investigate codebase.** Spawn a **Codebase Analyst** agent using the prompt at `agents/codebase-analyst.md`.

**2c — Consult domain expert (when relevant).** Check `.claude/agents/` for a domain expert agent whose description matches the feature's domain:

| Agent                   | Domain                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| `agent-stream-pipeline` | Streaming, chunk processing, token buffering, backpressure       |
| `auth-layer`            | OAuth, API keys, token storage, auth state, credential injection |
| `release`               | Packaging, CI, code signing, auto-updater, versioning            |

If the feature touches one of these domains, spawn that agent with the user's requirement and ask it to:

1. Review the proposed feature for domain-specific concerns.
2. Identify constraints, gotchas, or patterns that must be followed.
3. Flag risks or conflicts with existing domain architecture.

If no domain expert applies, skip this step.

### Phase 3: Create Spec

Instantiate the spec template at `spec-template/spec.md`. The template is the single source of truth for spec structure — Overview, Requirements (FR/NFR tables with hard verification columns), Architecture, Unit Tests table, Playwright E2E Tests table, Anti-patterns, Team Orchestration Plan, Open Questions, and the Adversarial Review Summary placeholder.

Rules for Phase 3:

1. Read `spec-template/spec.md` and instantiate it; do not invent additional top-level sections.
2. Every requirement row MUST have a concrete, automatable `Verification` value — no subjective criteria.
3. Every requirement must be referenced by at least one row in Unit Tests or Playwright E2E Tests (ideally both where user-visible).
4. Test file paths must match real package/app conventions (Vitest in `__tests__/` with `.test.ts`; Playwright in the owning app's e2e dir with `.spec.ts`). Verify against the codebase, don't guess.
5. Team Orchestration Plan must name real agents from `.claude/agents/` or explicitly recommend `/create-codebase-expert` for missing owners.

### Phase 4: Adversarial Critique Loop

After the spec is drafted, spawn **two agents in parallel** (three if a domain expert was consulted in Phase 2):

- **Adversarial Spec Reviewer** — spawn with the prompt at `agents/adversarial-reviewer.md`.
- **Domain Expert** (if consulted in Phase 2) — re-spawn with the full spec, asking it to review for domain-specific correctness, missed constraints, and compatibility with existing domain architecture.

After critique completes:

1. Evaluate each concern. Not all feedback is valid — reject concerns that contradict the user's explicit requirements.
2. For accepted concerns: update the spec.
3. If significant changes were made (any Critical or 2+ Important concerns accepted), re-run the adversarial reviewer on the updated spec.
4. Iterate until the adversarial reviewer returns no Critical concerns and no more than 1 Important concern.
5. Record the critique results in an **Adversarial Review Summary** table at the bottom of the spec:

| Concern   | Severity   | Resolution                             |
| --------- | ---------- | -------------------------------------- |
| {concern} | {severity} | **Accepted** / **Rejected** — {reason} |

### Phase 5: Final Verification

Spawn a **Verification Agent** with the prompt at `agents/verification.md`. If it finds failures, fix them in the spec and re-verify only the failed items.

### Final Output

1. Write the spec to `workspace/spec/{feature-name}-spec.md` (kebab-case filename).
2. Present a summary including: spec location, FR/NFR counts, unit + E2E test counts, orchestration summary, adversarial review tallies (raised / accepted / rejected, no unresolved Critical), and verification result.

## Examples

✓ Good invocation:

```
User: "Create a spec for a rate-limited magic-link login flow in mirror. Budget: 2 weeks. Must reuse existing Convex auth."

→ Phase 1 passes (scope, constraint, reuse boundary all explicit).
→ Phase 2 spawns Codebase Analyst + auth-layer domain expert.
→ Phase 3 instantiates spec-template/spec.md with FRs tied to real e2e paths
  in apps/mirror/tests/.
→ Phase 4 adversarial loop flags one Critical (no abuse-mitigation NFR);
  accepted and spec updated.
→ Phase 5 verification passes.
```

✗ Bad invocation:

```
User: "Spec out the dashboard improvements."

→ Requirement is ambiguous — no scope, no constraints, no success criteria.
→ Correct response: stay in Phase 1 and ask clarifying questions.
→ Wrong response: guess at scope and run the full 5-phase workflow.
```

## Anti-patterns

- **Skipping Phase 1 clarifications.** Spawning agents on an ambiguous requirement wastes context and produces a spec the user will reject.
- **Inventing extra top-level sections.** The template is the schema. Add rows, not new H2s.
- **Subjective verification criteria.** "Feels fast", "user-friendly", "looks good" — none are automatable. Every FR/NFR row needs a check a CI job could run.
- **Guessing file paths.** Fabricated paths in the Team Orchestration Plan or test tables make the spec unactionable. Verify against the codebase.
- **Naming an executor for Phase 3 inside this skill.** Creates a cycle with any agent that references this skill. The caller owns routing.
- **Accepting adversarial concerns that contradict explicit user requirements.** Reject them and log the rejection in the Adversarial Review Summary.
- **Running the adversarial loop once and stopping.** Iterate until no Critical concerns remain — that's the contract.

## References

- `spec-template/spec.md` — spec schema (single source of truth for structure).
- `agents/codebase-analyst.md` — Phase 2b prompt.
- `agents/adversarial-reviewer.md` — Phase 4 prompt.
- `agents/verification.md` — Phase 5 prompt.
- `.claude/skills/create-codebase-expert/SKILL.md#artifact-hierarchy-principle` — why templates and workflow-only agents live under this skill, not inlined.
