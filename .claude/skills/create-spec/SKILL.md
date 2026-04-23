---
name: create-spec
description: Create a product spec from user requirements through multi-agent research, adversarial critique, and iterative refinement. Spawns PM, Adversarial Reviewer, domain expert (when relevant), and Verification agents in separate context windows. Outputs a spec with Playwright E2E tests to workspace/spec/. Use when the user wants to create a spec, write requirements, plan a feature, or says "create spec", "spec this", "write a spec".
---

## Quick start

1. Confirm the requirement is unambiguous (Phase 1). If not, ask clarifying questions before spawning any agents.
2. Gather materials in parallel: read provided research, spawn the Codebase Analyst, and (if the domain matches) consult a domain expert (Phase 2).
3. Instantiate `spec-template/spec.md` into `workspace/spec/{YYYY-MM-DD}-{feature-name}-spec.md` with hard-verification requirements and real test paths (Phase 3).
4. Run the adversarial critique loop until no Critical concerns remain (Phase 4).
5. Spawn the Verification Agent; fix any failures; write the final spec and summary (Phase 5).

## Workflow

Invariants that apply across all phases:

- **Minimum 3 specialist sub-agents spawned**: Codebase Analyst (Phase 2b), Adversarial Reviewer (Phase 4), Verification Agent (Phase 5). Each gets its own context window via the Agent tool. The invoking agent acts as the PM — it owns spec drafting and integration.
- **Domain expert is additive**: when consulted, it adds a 4th agent used in both Phase 2 and Phase 4.
- **Hard verification only**: every requirement row must have a concrete, automatable check.
- **Codebase accuracy**: every file path in the spec must be verified against the real codebase.
- **User requirements are sovereign**: if the adversarial reviewer argues against something the user explicitly requested, reject it and document why.
- **One-directional dependency**: `spec-template/` (local) + `.claude/agents/create-spec/` (shared) ← `SKILL.md` ← caller. This skill does not name its executor — the invoking agent owns Phase 3 routing.

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

**2b — Investigate codebase.** Spawn the `create-spec-codebase-analyst` agent (defined at `.claude/agents/create-spec/codebase-analyst.md`).

**2c — Consult domain expert (when relevant).** Check `.claude/agents/` for an agent whose description matches the feature's domain. Current domain experts in this repo:

| Agent                    | Domain                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `chat-backend-developer` | Convex chat agent layer — LLM streaming, RAG, system prompts, chat schema/mutations |
| `design-system-manager`  | Design tokens, shadcn/ui components, styling consistency                            |

If no listed agent fits, scan `.claude/agents/` directly — new experts may have been added since this list was written. If the feature touches a matching domain, spawn that agent with the user's requirement and ask it to:

1. Review the proposed feature for domain-specific concerns.
2. Identify constraints, gotchas, or patterns that must be followed.
3. Flag risks or conflicts with existing domain architecture.

If no domain expert applies, skip this step.

### Phase 3: Create Spec

Instantiate the spec template at `spec-template/spec.md`. The template is the single source of truth for spec structure, in this order:

1. **What the user gets** — user-POV bullets (alignment checkpoint)
2. **Non-goals** — explicit scope cliff (what we're deliberately NOT doing)
3. **How we'll know it works** — user-flow scenarios mapped to FRs and Playwright test files (single source of truth for E2E coverage)
4. **Requirements** — FR/NFR tables with hard verification columns
5. **Architecture** — five required subsections: (1) Components and structure, (2) How data flows, (3) Why this works (with Alternatives-considered table), (4) Edge cases and gotchas, (5) Upstream artifact impact
6. **Unit Tests** table
7. **Adversarial Review Summary** placeholder

Rules for Phase 3:

1. Read `spec-template/spec.md` and instantiate it; do not invent additional top-level sections.
2. **`What the user gets` must be written in user-POV, plain language — no tech jargon, no implementation verbs.** This is the alignment checkpoint; if it reads like implementation notes, the section has failed its job.
3. **`Non-goals` may not be empty.** If there are genuinely no non-goals, say so and justify why. This is the scope cliff that stops quick-win creep during implementation.
4. **Every `How we'll know it works` scenario must be in user-flow language and reference at least one FR.** No internal state checks, no "component renders" — describe what the user does and what they see.
5. Every requirement row MUST have a concrete, automatable `Verification` value — no subjective criteria.
6. Every requirement must be referenced by at least one row in Unit Tests or `How we'll know it works` (ideally both where user-visible).
7. **All five Architecture subsections must be populated.** For small features a single sentence per subsection is acceptable, but none may be empty or collapsed into another.
   - Subsection 3 (`Why this works`) — the _Alternatives considered_ table needs at least two entries. "Most obvious approach" does not count.
   - Subsection 5 (`Upstream artifact impact`) — must name the rule/skill/template/lint being patched, or explicitly justify "none". Enforces _Always Choose the Compounding Option_ from `AGENTS.md`.
8. Test file paths must match real package/app conventions (Vitest in `__tests__/` with `.test.ts`; Playwright in the owning app's e2e dir with `.spec.ts`). Verify against the codebase, don't guess. The `Test file` column in `How we'll know it works` may be left blank during drafting, but must be populated before implementation begins.

Orchestration — executor selection, reviewer pairing, wave sequencing, and hard gate commands — is NOT the spec's job. `.claude/skills/orchestrate-implementation/SKILL.md` owns that at execution time. The spec describes _what must be true_; orchestration decides _who builds and who reviews_. The executor/critic separation is still load-bearing (see https://www.anthropic.com/engineering/harness-design-long-running-apps) — it's just enforced downstream, not here.

### Phase 4: Adversarial Critique Loop

After the spec is drafted, spawn **two agents in parallel** (three if a domain expert was consulted in Phase 2):

- **`create-spec-adversarial-reviewer`** — defined at `.claude/agents/create-spec/adversarial-reviewer.md`.
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

Spawn the `create-spec-verification` agent (defined at `.claude/agents/create-spec/verification.md`). If it finds failures, fix them in the spec and re-verify only the failed items.

### Final Output

1. Write the spec to `workspace/spec/{YYYY-MM-DD}-{feature-name}-spec.md` (ISO date prefix, kebab-case feature name). Use today's date. Set the `**Created:**` line in the spec header to the same date.
2. Present a summary including: spec location, FR/NFR counts, unit + E2E test counts, adversarial review tallies (raised / accepted / rejected, no unresolved Critical), and verification result.

### Implementation handoff

This skill ends when the spec is verified. The downstream half of the pipeline is `.claude/skills/orchestrate-implementation/SKILL.md` — it consumes the spec and plans wave execution at that point (executor/verifier separation, feedback loops, critique-budgeting). When the user wants to start building, hand off to that skill rather than orchestrating ad-hoc.

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

## Anti-patterns

These complement the Phase rules above; they call out the failure modes most likely to slip past rule-checking.

- **Skipping Phase 1 clarifications.** Spawning agents on an ambiguous requirement wastes context and produces a spec the user will reject.
- **Collapsing Architecture subsections.** All five (Components / Data flow / Why this works / Edge cases / Upstream artifact impact) must be populated. "Why this works", "Edge cases", and "Upstream artifact impact" are the highest-leverage sections — omitting them defeats the point.
- **Guessing file paths.** Fabricated paths in the Architecture section or test tables make the spec unactionable. Verify against the codebase.
- **Naming an executor for Phase 3 inside this skill.** Creates a cycle with any agent that references this skill. The caller owns routing.
- **Accepting adversarial concerns that contradict explicit user requirements.** Reject them and log the rejection in the Adversarial Review Summary.
- **Running the adversarial loop once and stopping.** Iterate until no Critical concerns remain — that's the contract.
- **Smuggling orchestration back into the spec.** Wave sequencing, executor assignments, reviewer pairing, and hard-gate shell commands live in `orchestrate-implementation`, not here. The spec describes _what must be true_ and leaves _who builds, who reviews, and in what order_ to the downstream skill.

## References

- `spec-template/spec.md` — spec schema (single source of truth for structure).
- `.claude/agents/create-spec/codebase-analyst.md` — Phase 2b agent (`create-spec-codebase-analyst`).
- `.claude/agents/create-spec/adversarial-reviewer.md` — Phase 4 agent (`create-spec-adversarial-reviewer`).
- `.claude/agents/create-spec/verification.md` — Phase 5 agent (`create-spec-verification`).
- `.claude/skills/create-codebase-expert/SKILL.md#artifact-hierarchy-principle` — why templates and workflow-only agents live under this skill, not inlined.
- `.claude/skills/orchestrate-implementation/SKILL.md` — downstream skill that owns the critique routing table and wave execution model. The spec feeds into it; it does not duplicate its reviewer-selection logic.
