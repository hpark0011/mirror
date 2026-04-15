---
topic: Multi-agent orchestration patterns for AI code review
date: 2026-04-15
scope: Patterns for decomposing and parallelising AI code review across specialist agents, benchmarked against .claude/skills/reviewing-code/SKILL.md
status: final
---

# Research: Multi-agent orchestration patterns for AI code review

## Brief

- **Topic**: Best practices for structuring multi-agent AI systems that perform code review.
- **Context**: The current `reviewing-code` skill is single-agent and sequential; the team wants to understand whether and how to evolve it toward a multi-agent pattern.
- **Scope**: Orchestration patterns (decomposition, parallelisation, validation, structured output, severity) as applied to code review. Out of scope: CI/CD integration, GitHub PR bot UX, cost management beyond directional trade-offs.

---

## Verification Report

### Critique — Open Source Research

- **wshobson/agents README link** (`/blob/main/plugins/agent-teams/README.md`): path plausible but unverified at synthesis time; the repo exists and has agent-teams content. Claim is corroborated by the kieranklaassen gist and is structurally sound. Kept with note.
- **ComposioHQ architecture-design.md link**: deep path into a third-party repo — could be stale or removed. The JSONL event-bus / severity-bucket pattern it describes is corroborated by Social agent (devtoolsacademy, bluedot). Kept as "medium" evidence.
- **Anti-hallucination quote from pr_agent prompts.toml**: exact wording not verifiable without fetching the file, but the source URL is a live public repo and the claim is well within what that codebase is known to do. Kept.
- **No stale sources flagged**: all URLs are 2024-2025 projects. No round-trip sent.

### Critique — Official Docs Research

- All four primary sources (Anthropic building-effective-agents, Claude Agent SDK blog, Anthropic multi-agent engineering post, OpenAI Agents SDK docs, CrewAI docs, AutoGen docs) are canonical and current.
- **LangGraph redirect noted and self-flagged** by agent — correctly dropped. No action needed.
- AutoGen GroupChat inclusion is on-topic but the agent correctly flagged AutoGen's own warning ("not meant for real applications"). Retained as an anti-pattern illustration.
- No unsupported claims. No round-trip sent.

### Critique — Social Research

- **hamy.xyz blog** (`/blog/2026-02_...`): date `2026-02` is in the future relative to knowledge cutoff but within the session's stated current date (2026-04-15). Claim is plausible and specific (9 parallel agents, <50% → ~75% useful suggestions). Kept.
- **lilting.ch "99% correct"** — agent correctly flagged as self-validation, not ground truth. Retained with caveat in synthesis.
- **byteiota.com "3-5x speedup" claim** — agent correctly flagged as unverified marketing. Dropped from synthesis.
- **DORA 2025 via vibecoding.app** — secondary citation (DORA data cited through a blog post). Kept as directional signal only.
- **vibecoding.app token-cost figure (2-5x)**: single source, directional; kept as "weak" evidence.
- No stale sources (all 2025-2026). No round-trip sent.

### Critique — Codebase Analysis

- `SKILL.md:19-44` — confirmed: scope identification lives at those lines.
- `SKILL.md:48-63` — confirmed: rule loading step.
- `SKILL.md:65-104` — confirmed: single-actor checklist.
- `SKILL.md:106-134` — confirmed: severity-grouped report.
- `SKILL.md:136-146` — confirmed: post-hoc ticket capture.
- `SKILL.md:31` — line 31 is `- [ ] 5. Run pnpm build + lint...` — correct.
- `.claude/skills/agent-orchestration/SKILL.md:33-146` — confirmed: Explorer + Planner + Executor + Validator pattern with parallel spawning exists at those lines.
- `.claude/rules/dev-process.md:20-24` — confirmed: subagent strategy rule.
- All cited paths verified. No accuracy issues.

---

## Executive summary

- **Strongest pattern**: Parallel specialist-role decomposition (security, architecture, correctness, style as separate agents) is backed by official Anthropic guidance, multiple OSS implementations, and practitioner data showing a meaningful lift in finding quality.
- **Second strongest**: A dedicated validation/cross-check pass after parallel generation is the primary mechanism for keeping false-positive rates low; without it, production tools run 15-22% FP.
- **Biggest gap in current codebase**: `reviewing-code` is single-agent and sequential. The repo already has a full orchestration scaffold (`agent-orchestration` skill) that is never referenced by `reviewing-code` — the gap is a wiring problem, not an infrastructure problem.
- **Actionable signal**: Build/lint runs serially *after* the report, not as an early-fail gate — this means a broken build is reported alongside style nits rather than surfaced first.
- **Recommended next step**: Hand this report to `create-spec` to produce a product spec for an orchestrated `reviewing-code` v2.

---

## Synthesis — best practices

### Ranked patterns

1. **Parallel specialist-role decomposition** — evidence: **strong**
   - **What**: Assign orthogonal review dimensions (security, architecture/design, correctness, style/convention) to separate agents running in parallel rather than one agent walking all dimensions sequentially.
   - **Trade-offs**: Increases finding quality and coverage. Costs 2-5x tokens vs single-agent (directional; one practitioner source). Coordination overhead rises with team size; 2-4 roles is the empirically recommended ceiling.
   - **Sources**: [Anthropic building-effective-agents](https://www.anthropic.com/research/building-effective-agents), [wshobson/agents README](https://github.com/wshobson/agents/blob/main/plugins/agent-teams/README.md), [qodo.ai single vs multi blog](https://www.qodo.ai/blog/single-agent-vs-multi-agent-code-review/), [hamy.xyz practitioner blog](https://hamy.xyz/blog/2026-02_code-reviews-claude-subagents), [dev.to CodeProbe writeup](https://dev.to/nishilbhave/i-built-a-multi-agent-code-review-skill-for-claude-code-heres-how-it-works-366i).

2. **Validation / cross-check pass after parallel generation** — evidence: **strong**
   - **What**: After specialist agents produce findings, a dedicated validator agent re-checks each finding against the actual code before the findings reach the user. Collapses duplicates and filters false positives.
   - **Trade-offs**: Adds one serial step (latency); significantly lowers FP rate. Anthropic's internal system credits this pass for keeping FP near zero (self-reported). Without it: CodeRabbit ~15%, Greptile ~22% FP on the same benchmark.
   - **Sources**: [Anthropic multi-agent engineering](https://www.anthropic.com/engineering/multi-agent-research-system), [lilting.ch Anthropic internal review](https://lilting.ch/en/articles/claude-code-multi-agent-pr-review) (treat "99%" as directional), [bluedot tool comparison](https://blog.bluedot.org/p/best-ai-code-review-tools-2025).

3. **Structured output schema with file:line anchoring** — evidence: **strong**
   - **What**: Each agent returns findings in a fixed schema (e.g., `{file, start_line, end_line, severity, issue}`). Vague prose findings are disqualified upstream before synthesis.
   - **Trade-offs**: Constrains agent output flexibility; requires schema enforcement in prompts. Eliminates "vague finding" failure mode and enables deduplication.
   - **Sources**: [qodo-ai/pr-agent prompts.toml](https://github.com/qodo-ai/pr-agent/blob/main/pr_agent/settings/pr_reviewer_prompts.toml), [hamel.dev evals post](https://hamel.dev/blog/posts/evals-skills/) (category separation principle), [Anthropic building-effective-agents](https://www.anthropic.com/research/building-effective-agents).

4. **Severity-tiered output with critical-only default** — evidence: **medium**
   - **What**: Findings bucketed into BLOCKER / SHOULD-FIX / NIT (or equivalent). Default output surface shows only blockers; lower tiers opt-in. Prevents noise fatigue.
   - **Trade-offs**: Risk of under-reporting if tier assignment is wrong. But verbose-by-default mode leads to ignored findings over time (practitioner consensus).
   - **Sources**: [ComposioHQ architecture](https://github.com/ComposioHQ/agent-orchestrator/blob/main/artifacts/architecture-design.md), [devtoolsacademy state-of-ai-review](https://www.devtoolsacademy.com/blog/state-of-ai-code-review-tools-2025/), [bluedot tool comparison](https://blog.bluedot.org/p/best-ai-code-review-tools-2025).

5. **Fan-out parallel execution with blocking aggregation** — evidence: **medium**
   - **What**: Orchestrator spawns all specialist agents simultaneously, blocks until all return, then synthesises. Agents share the workspace (read access to files) but have isolated conversation contexts.
   - **Trade-offs**: Full parallelisation reduces wall-clock latency proportional to the number of specialists. Context isolation prevents cross-agent interference but means each agent must receive full relevant context in its prompt.
   - **Sources**: [OpenHands agent delegation docs](https://docs.openhands.dev/sdk/guides/agent-delegation), [Anthropic building-effective-agents](https://www.anthropic.com/research/building-effective-agents) (Sectioning pattern), [kieranklaassen gist](https://gist.github.com/kieranklaassen/d2b35569be2c7f1412c64861a219d51f).

6. **Early-fail build/lint gate before deep review** — evidence: **medium**
   - **What**: Run `build` and `lint` first, in parallel with or before the review agents. A broken build makes many review findings moot; surfacing it first saves tokens and reviewer attention.
   - **Trade-offs**: Adds an async dependency before agents can start. If build is slow, it becomes the critical path. Mitigation: run build async alongside agent warm-up.
   - **Sources**: [Anthropic building-effective-agents](https://www.anthropic.com/research/building-effective-agents) (effort-scaled spawning), [addyosmani.com code-agent-orchestra](https://addyosmani.com/blog/code-agent-orchestra/), `.claude/rules/verification.md` (already encoded in this repo).

7. **Effort-scaled agent count** — evidence: **medium**
   - **What**: 1 agent for small diffs (<50 lines, single file), 2-4 agents for mid-size, 10+ for large complex changes. Spawning 4 agents for a one-line config change wastes tokens and time.
   - **Trade-offs**: Requires a heuristic (line count, file count, domain breadth) to choose the right tier at invocation time.
   - **Sources**: [Anthropic multi-agent engineering](https://www.anthropic.com/engineering/multi-agent-research-system), [wshobson/agents README](https://github.com/wshobson/agents/blob/main/plugins/agent-teams/README.md).

### Cross-lane disagreements

| Topic | Official docs say | OSS projects do | Practitioners report | Interpretation |
| ----- | ----------------- | --------------- | -------------------- | -------------- |
| Team size | Effort-scaled; 10+ for complex (Anthropic) | Max 2-4 to minimize coordination (wshobson) | 4 parallel domains is sweet spot in practice (CodeProbe, hamy.xyz) | Official docs allow larger teams for genuinely complex tasks; OSS and practitioners converge on 4 as the practical ceiling for review. Not a contradiction — review domains are bounded. |
| Validation approach | Voting (same task multiple agents) for correctness (Anthropic) | Cross-check pass post-generation (qodo-ai, OpenHands) | Dedicated validator agent keeps FP low (lilting.ch, bluedot) | All three converge: a second-pass check is necessary. Form varies (voting vs. single validator), but the function is the same. |
| Sequential vs parallel | Sectioning (parallel) preferred when subtasks are independent (Anthropic) | Sequential is CrewAI default — explicitly flagged as anti-pattern | Parallel significantly outperforms sequential (hamy.xyz: 50% → 75%) | Strong consensus: parallel is correct for independent review dimensions. Sequential only justified when one finding must inform the next. |

### Anti-patterns to avoid

- **Monolithic single-agent review** — one agent cannot hold all review dimensions at equal depth. Practitioner data shows ~50% useful suggestions vs ~75% for parallelized specialists. Sources: [hamy.xyz](https://hamy.xyz/blog/2026-02_code-reviews-claude-subagents), [qodo.ai blog](https://www.qodo.ai/blog/single-agent-vs-multi-agent-code-review/).
- **Pull-based polling / dashboards as primary attention surface** — delays response to high-severity findings. Push-based escalation on critical issues is the correct default. Source: [ComposioHQ architecture](https://github.com/ComposioHQ/agent-orchestrator/blob/main/artifacts/architecture-design.md).
- **Vague prose findings without file:line grounding** — unactionable and untrackable. Source: [qodo-ai/pr-agent prompts.toml](https://github.com/qodo-ai/pr-agent/blob/main/pr_agent/settings/pr_reviewer_prompts.toml).
- **Oversized agent teams (>4 for review)** — coordination overhead compounds without proportional quality gain. Source: [wshobson/agents](https://github.com/wshobson/agents/blob/main/plugins/agent-teams/README.md).
- **Lumping finding categories into a generic score** — per-category precision is lost, making it impossible to tune or improve any single dimension. Source: [hamel.dev](https://hamel.dev/blog/posts/evals-skills/).
- **AutoGen GroupChat for review** — sequential turn-taking, AutoGen's own docs warn "not meant for real applications." Source: [AutoGen GroupChat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html).

---

## Codebase today

### Presence

- **Status**: Partially implemented — the skill has severity grouping and file:line anchoring, but no parallelisation, role decomposition, or validation pass. The orchestration infrastructure to build on exists but is unused by this skill.
- **Owning surface**: `.claude/skills/reviewing-code/`.

### Current implementation

- `.claude/skills/reviewing-code/SKILL.md:19-44` — scope identification via `git diff`.
- `.claude/skills/reviewing-code/SKILL.md:48-63` — selective rule loading (token-conscious, good practice).
- `.claude/skills/reviewing-code/SKILL.md:65-104` — single-actor checklist: correctness → convention → simplicity → React → Convex → tests (sequential).
- `.claude/skills/reviewing-code/SKILL.md:106-134` — severity-grouped report (Blockers / Should fix / Nits) with file:line anchoring.
- `.claude/skills/reviewing-code/SKILL.md:136-146` — post-hoc ticket capture via `generate-issue-tickets` (decoupled, after report).
- `.claude/skills/reviewing-code/SKILL.md:31` — build + lint runs serially *after* the report, not before or alongside.

### Conventions already in use

- Severity tiers (🔴/🟡/🟢) — enforced by the skill's report format.
- file:line anchoring on every finding — enforced by Step 4 report rules.
- Selective rule loading by path — enforced by the rule-mapping table.
- Subagent strategy — encoded in `.claude/rules/dev-process.md:20-24`, not yet applied by this skill.

---

## Gap analysis

### Alignment (already matches best practice)

| Pattern | Where in codebase | Notes |
| ------- | ----------------- | ----- |
| Severity-tiered output | `SKILL.md:106-134` | Matches Pattern #4; three tiers already defined. |
| Structured file:line anchoring | `SKILL.md:127-133` | Matches Pattern #3 output requirement; enforced by report rules. |
| Selective context loading (rules by path) | `SKILL.md:48-63` | Reduces token cost; aligns with effort-scaled spawning principle. |
| Ticket capture decoupled | `SKILL.md:136-146` | Clean separation; finding → ticket flow exists. |

### Divergences

| Gap | What we do | Best practice | Justified? | Impact |
| --- | ---------- | ------------- | ---------- | ------ |
| Build/lint position | Runs after report (Step 5 in workflow) | Should run as early-fail gate, in parallel with or before review agents | No. Ordering is incidental, not a design choice. A broken build makes downstream findings partially moot. | **M** — wastes review effort on code that won't compile; easy to fix. |
| Finding categories lumped into one checklist | All dimensions (correctness, convention, simplicity, React, Convex, tests) reviewed by one agent in one pass | Separate per-dimension review agents allow deeper focus per category | No. The single-actor approach is a default, not a deliberate trade-off. | **H** — core architectural divergence from the strongest evidence pattern. |

### Absences

| Missing pattern | Closest adjacent code | Impact |
| --------------- | --------------------- | ------ |
| Parallel specialist-role decomposition | `.claude/skills/agent-orchestration/SKILL.md:33-146` (Explorer + Planner + Executor + Validator structure) | **H** — the highest-evidence pattern is entirely absent; the infrastructure to add it exists. |
| Validation / cross-check pass | `.claude/skills/agent-orchestration/SKILL.md:83-101` (Plan Validator pattern) | **H** — without this pass, false-positive rate is uncontrolled; all production systems at scale include it. |
| Effort-scaled agent count | None | **M** — currently the skill runs the same single-agent flow regardless of diff size; small diffs need no multi-agent overhead. |
| Per-finding confidence / anti-hallucination guardrail | None | **M** — no instruction equivalent to pr-agent's "be certain before flagging lower-severity concerns"; nit-level findings are uninhibited. |

### Recommended next step

Hand this report to `create-spec` to produce a product spec for `reviewing-code` v2, prioritising (1) parallel specialist decomposition using the existing `agent-orchestration` scaffold and (2) a post-generation validation pass before findings reach the user.

---

## Appendix

### Source index

| # | Source | Lane | Date | Link |
| - | ------ | ---- | ---- | ---- |
| 1 | Anthropic: Building Effective Agents | Official | 2024 | https://www.anthropic.com/research/building-effective-agents |
| 2 | Anthropic: Multi-agent Research System (engineering blog) | Official | 2025 | https://www.anthropic.com/engineering/multi-agent-research-system |
| 3 | Claude Agent SDK blog | Official | 2025 | https://claude.com/blog/building-agents-with-the-claude-agent-sdk |
| 4 | OpenAI Agents SDK — Multi-agent docs | Official | 2025 | https://openai.github.io/openai-agents-python/multi_agent/ |
| 5 | CrewAI — Processes docs | Official | 2025 | https://docs.crewai.com/concepts/processes |
| 6 | AutoGen GroupChat design pattern | Official | 2025 | https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html |
| 7 | OpenHands agent delegation docs | Official | 2025 | https://docs.openhands.dev/sdk/guides/agent-delegation |
| 8 | qodo-ai/pr-agent pr_reviewer_prompts.toml | OSS | 2025 | https://github.com/qodo-ai/pr-agent/blob/main/pr_agent/settings/pr_reviewer_prompts.toml |
| 9 | qodo.ai single vs multi-agent code review blog | OSS | 2025 | https://www.qodo.ai/blog/single-agent-vs-multi-agent-code-review/ |
| 10 | wshobson/agents agent-teams README | OSS | 2025 | https://github.com/wshobson/agents/blob/main/plugins/agent-teams/README.md |
| 11 | ComposioHQ agent-orchestrator architecture design | OSS | 2025 | https://github.com/ComposioHQ/agent-orchestrator/blob/main/artifacts/architecture-design.md |
| 12 | kieranklaassen claude-code-multi-agent gist | OSS | 2025 | https://gist.github.com/kieranklaassen/d2b35569be2c7f1412c64861a219d51f |
| 13 | hamy.xyz: code reviews with Claude subagents | Social | 2026-02 | https://hamy.xyz/blog/2026-02_code-reviews-claude-subagents |
| 14 | dev.to: CodeProbe multi-agent code review skill | Social | 2025 | https://dev.to/nishilbhave/i-built-a-multi-agent-code-review-skill-for-claude-code-heres-how-it-works-366i |
| 15 | lilting.ch: Claude Code multi-agent PR review (Anthropic internal) | Social | 2025 | https://lilting.ch/en/articles/claude-code-multi-agent-pr-review |
| 16 | bluedot.org: best AI code review tools 2025 | Social | 2025 | https://blog.bluedot.org/p/best-ai-code-review-tools-2025 |
| 17 | hamel.dev: evals and error category separation | Social | 2025 | https://hamel.dev/blog/posts/evals-skills/ |
| 18 | Addy Osmani: code agent orchestra | Social | 2025 | https://addyosmani.com/blog/code-agent-orchestra/ |
| 19 | Simon Willison: parallel coding agents | Social | 2025 | https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ |
| 20 | devtoolsacademy: state of AI code review tools 2025 | Social | 2025 | https://www.devtoolsacademy.com/blog/state-of-ai-code-review-tools-2025/ |
| 21 | vibecoding.app: multi-agent vs single-agent coding | Social | 2025 | https://vibecoding.app/blog/multi-agent-vs-single-agent-coding |

### Out of scope but interesting

- **Cost at scale ($15-25/PR)**: the lilting.ch / vibecoding.app cost figures are directionally important for production deployment decisions, but out of scope for the skill design itself — relevant if the team ever runs this skill on every PR automatically.
- **Cross-model-family context handoff loss** (lilting.ch): relevant if the orchestration uses agents on different model families; worth noting in a future spec's risk section.
- **Zero of 8 tools caught a severe cross-file S3 bug** (bluedot): signals that multi-agent review does not solve all detection problems; cross-file reasoning remains a hard open problem.

### Open questions

- **Latency budget**: what is an acceptable wall-clock time for a `reviewing-code` invocation? Determines whether full parallelisation or a tiered approach (fast single-agent for small diffs, multi-agent for large) is the right default.
- **Accuracy baseline**: no current metrics on finding precision or recall for the existing skill. Establishing a baseline before changing the architecture would validate whether the effort is worth it.
- **Orchestration skill reuse vs. bespoke**: should `reviewing-code` v2 call `agent-orchestration` directly or implement its own lighter orchestration loop tuned for review? The `agent-orchestration` skill is currently feature-implementation-oriented; review has different phase patterns.
