---
name: researching-best-practices
description: Researches industry best practices for a feature across open source, official docs, and social sources, then compares findings to the current codebase to produce a verified synthesis and gap analysis. Use when the user says "research best practices for X", "find how others do X", "benchmark our X against the industry", or wants a synthesis report before speccing or implementing a feature. Stops at the research report — does NOT produce a product spec (hand off to create-spec for that).
argument-hint: "[feature-or-topic]"
---

# Researching Best Practices

Produces a verified research synthesis and codebase gap analysis for a named feature. Runs four external research sub-agents in parallel (open source, official docs, social, academic research papers), a codebase analyst, and a verification agent that both critiques each researcher and reconciles findings into the final synthesis. Output is a single markdown report in `workspace/research/` — no spec, no implementation plan.

## Scope & non-goals

- **Not a spec generator.** The output is research + gap analysis. For FR/NFR tables, test plans, and orchestration, pass the report to [`create-spec`](../create-spec/SKILL.md).
- **Not a debugging tool.** For root-cause investigation of a specific bug, use [`project-debug`](../project-debug/SKILL.md).
- **Not for trivial lookups.** One-file questions ("how does React.memo work") don't justify five sub-agents — answer directly.
- **Stops at the gap report.** Implementation and spec authoring happen in downstream skills.

## Quick start

1. Confirm the feature/topic and scope with the user if ambiguous.
2. Spawn four research sub-agents + the codebase analyst in parallel (single message, five `Agent` calls) using the registered subagents in `.claude/agents/research/`.
3. Spawn the verification agent once all five return — it critiques each research agent and produces the final synthesis + gap analysis.
4. Write the report to `workspace/research/{topic-kebab}.md` and return the path.

## Workflow

Invariants:

- **Exactly 6 sub-agents**, each with its own context window via the Agent tool: four researchers (open source, official docs, social, research paper review), one codebase analyst, one verification agent.
- **Researchers + analyst run in parallel** — single message, multiple Agent calls. Never sequential.
- **Verification is sequential** — it needs all five prior outputs as input.
- **Output directory is `workspace/research/`** — not `workspace/spec/` (that's owned by `create-spec`).
- **No spec artifacts.** No FR/NFR tables, no test plans, no orchestration. Just research + gap.

### Phase 1 — Clarify the brief

Before spawning any agent, confirm:

1. **Feature/topic** — one sentence naming what to research (e.g. "streaming chat responses with backpressure").
2. **Context** — why the user is researching (new feature vs. improving existing).
3. **Scope boundaries** — what's in, what's explicitly out.

If any of these are missing and can't be inferred, ask before proceeding. Spawning five agents on "research our auth" without scope burns context and returns a rejected report.

### Phase 2 — Parallel research + codebase scan

Spawn all five agents in a **single message** with multiple parallel `Agent` tool calls. Pass `Topic`, `Context`, and `Scope` verbatim in each prompt — the agent's system prompt handles the rest.

| # | `subagent_type`             | Purpose |
|---|-----------------------------|---------|
| 1 | `research-open-source`      | How popular OSS projects implement the feature |
| 2 | `research-official-docs`    | Canonical guidance from framework/library docs |
| 3 | `research-social`           | Blogs, YouTube, X, LinkedIn, Reddit, HN |
| 4 | `research-paper-review`     | Peer-reviewed + preprint academic literature (conferences, journals, arXiv) |
| 5 | `research-codebase-analyst` | Current implementation (or absence) in this repo |

Each research agent returns: key patterns, concrete examples with citations/links, trade-offs, and anti-patterns. The research-paper agent additionally returns problem framings, empirical claims, and author-stated limitations per paper. The codebase analyst returns: relevant files with line numbers, current patterns in use, and any obvious gaps versus the user's stated topic.

If the topic has no plausible academic literature (e.g. "which React form library should we use"), the research-paper agent returns an empty findings section with a one-line note — do not skip spawning it, so the verification agent has a complete record.

### Phase 3 — Verification + synthesis

Spawn the **`research-verification`** agent with all five prior outputs as input. It must:

1. Critique each research agent's work — flag unsupported claims, missing trade-offs, stale sources, or off-topic findings.
2. Ask each researcher to patch gaps if the critique surfaces blockers (**at most one round-trip per researcher** to avoid runaway loops).
3. Produce a final polished synthesis that merges the four research streams, de-duplicates, and ranks patterns by evidence strength. Academic findings should elevate or contradict practitioner patterns — note both.
4. Produce a gap analysis that compares the synthesis to the codebase analyst's findings: what exists, what's missing, what diverges from best practice and why that matters.

### Phase 4 — Write the report

Instantiate [`research-template/research.md`](research-template/research.md) into `workspace/research/{topic-kebab}.md`. The template owns the structure — do not invent sections. Every claim must link to its source; uncited claims get dropped.

Return the report path + one-sentence summary to the user. No file dump, no agent transcripts.

## Examples

✓ Good invocation:

```
User: "Research best practices for streaming LLM responses with backpressure —
      compare against what our mirror chat does today."

→ Phase 1 passes (topic + context + implicit scope: mirror chat).
→ Phase 2 spawns 4 researchers + codebase analyst in one message (5 parallel Agent calls).
→ Phase 3 verification flags that the social agent's Medium post has no code reference,
  asks for a replacement source, weighs the research-paper findings on backpressure
  against the OSS patterns, and produces synthesis + gap.
→ Phase 4 writes workspace/research/streaming-llm-backpressure.md.
```

✗ Bad invocation:

```
User: "Research our auth."

→ Topic is too broad (magic link? OAuth? session storage? token rotation?).
→ Correct response: ask to narrow before spawning any agent.
→ Wrong response: spawn five agents and return a 2000-line unfocused dump.
```

## Anti-patterns

- **Skipping Phase 1 clarification.** Five parallel sub-agents on a vague brief burns context and returns a report the user rejects.
- **Running researchers sequentially.** They're independent — always parallel, single message, multiple Agent calls.
- **Letting the verification agent produce a spec.** Its job is critique + synthesis + gap — not FR/NFR tables. Handoff to `create-spec` happens after this skill ends.
- **Uncited claims in the final report.** Every pattern, trade-off, or recommendation must link to its source. Strip unsourced material.
- **Adding a PM / spec phase.** Explicitly out of scope — this skill ends at the gap report. Do not grow the workflow.
- **Writing to `workspace/spec/`.** That directory is owned by `create-spec`. Use `workspace/research/`.
- **Unlimited critique loops.** Cap researcher rework at one round-trip each; if a source still doesn't hold up, drop it and note the gap.

## References

Registered subagent definitions (invoked via `subagent_type`):

- `research-open-source` — `.claude/agents/research/open-source.md`
- `research-official-docs` — `.claude/agents/research/official-docs.md`
- `research-social` — `.claude/agents/research/social.md`
- `research-paper-review` — `.claude/agents/research/paper-review.md`
- `research-codebase-analyst` — `.claude/agents/research/codebase-analyst.md`
- `research-verification` — `.claude/agents/research/verification.md`

Other:

- [`research-template/research.md`](research-template/research.md) — output schema.
- [`../create-spec/SKILL.md`](../create-spec/SKILL.md) — downstream skill for turning the synthesis into a product spec.
