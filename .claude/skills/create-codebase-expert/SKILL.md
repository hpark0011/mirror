---
name: create-codebase-expert
description: "Scaffold a self-improving codebase expert agent that owns a bounded coding layer and gets measurably sharper with every task. Each session ends with a log entry that patches the agent's spec or knowledge, so the next session is faster and more accurate. Use when the user asks to create a codebase expert, add a new subsystem expert, scaffold an agent that owns a coding area, set up a self-improving agent, or build an agent that owns a specific part of the codebase. Invoke with `/create-codebase-expert` or `/create-codebase-expert [domain-name]`."
disable-model-invocation: true
argument-hint: "[domain-name]"
---

# Create Codebase Expert

Scaffold a **self-improving codebase expert agent** — a domain agent that owns a bounded coding layer. The system has three parts.

1. **Agent spec** (`.claude/agents/<name>.md`) — domain boundary, how to operate, guiding principles, available skills/tools
2. **Knowledge** (`agent-memory/<name>/knowledge.md`) — architecture, data flow & contracts, gotchas, references
3. **Logs** (`agent-memory/<name>/logs.md`) — append-only session evals against 4 criteria, bottleneck identification, patches applied

The agent improves itself by ending every session with a log entry that patches either the spec or the knowledge file. This is enforced mechanically by a `SubagentStop` hook (`scripts/validate-session-log.mjs`) that blocks the subagent from ending until `logs.md` contains a fresh entry with `Bottleneck`, `Counterfactual`, and `Patch`.

## Scope & non-goals

**Do NOT use for**: one-off research agents, workflow-only sub-agents (those live under `agents/` in the owning skill), or agents that span the whole codebase without a clear boundary. Trigger phrases live in the frontmatter `description`.

## Quick start

```bash
/create-codebase-expert chat-backend-developer
```

Answer the boundary question when prompted (files/dirs owned, what it does NOT own). The skill writes `.claude/agents/<name>.md` + `.claude/agent-memory/<name>/{knowledge.md,logs.md}`, installs the `SubagentStop` hook, and runs `validate-scaffold.mjs`. Done when the validator exits 0.

## Guiding principles (encoded in every agent)

Non-negotiable order. Lower objectives never compromise higher ones.

1. **Verified correctness** — output meets criteria with concrete evidence
2. **Regression avoidance** — existing behavior preserved
3. **Efficiency** — fewer iterations, less time, fewer tokens
4. **Learning** — every session patches the system to serve 1–3 next time

## Workflow

### 1. Determine the domain

If no argument provided, ask: "What subsystem should this agent own? What are its boundaries (files/dirs/responsibilities), and what does it explicitly NOT own?"

Derive:

- **Agent name**: kebab-case, 1–3 words. **If the domain spans multiple layers of a feature (backend/frontend/infra/data), the layer MUST appear in the name** so the boundary is visible without opening the spec. Prefer `<feature>-<layer>-developer` (e.g., `chat-backend-developer`, `chat-frontend-developer`) over a bare feature name like `chat-agent`, which falsely implies end-to-end ownership. A bare feature name is only acceptable when the agent genuinely owns every layer of that feature.
- **Domain scope**: concrete files/dirs and the boundary where it hands off

### 2. Research the domain

Quality of the agent is bounded by quality of this step.

1. Read `.claude/agents/` to detect overlap (two agents must never own the same file) and pick an unused color
2. Read `codebase-expert-template/agent-spec.md` for current structure
3. Glob the domain's source — read entry points, key abstractions, any local README/docs
4. Identify: key files, architecture, data flow, contracts, recurring gotchas, build/test commands, relevant skills

### 3. Write the agent spec

Create `.claude/agents/<name>.md` from `codebase-expert-template/agent-spec.md`. Required sections, in order:

- Frontmatter (`name`, `description`, `model: opus`, unique `color`, `memory: project`, `tools:` **allowlist** scoped to the domain, `maxTurns: 40` as a safety ceiling)
- Domain Boundary (own / do NOT own — both explicit)
- How to Operate (the 5-step loop: load → plan → execute → verify → log & patch)
- Guiding Principles (the 4 objectives verbatim, plus domain-specific principles grounded in real code)
- Available Skills & Tools
- Verification (correctness checks + regression checks)
- Knowledge & Logs (pointers to the memory files)

Keep it short. Long specs are smell — real intelligence belongs in `knowledge.md` and accumulates through `logs.md` patches.

### 4. Bootstrap memory

Create `.claude/agent-memory/<name>/` with `knowledge.md` and `logs.md` copied from `codebase-expert-template/` (the `agent-spec.md` in that directory is for step 3 only — do NOT copy it into the agent's memory dir):

| File           | Customization                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `knowledge.md` | Replace `<Agent Name>`, set date. Leave sections as commented scaffolds — knowledge is patched in through real work, not pre-filled. |
| `logs.md`      | Replace `<Agent Name>`, set date. Leave empty.                                                                                       |

Do NOT pre-fill knowledge. Unverified content pollutes the signal.

### 5. Register the SubagentStop enforcement hook

Step 5 of the agent's operating loop (Log & Patch) is the load-bearing self-improvement step, so it must be enforced mechanically — not left to prompt discipline. Register a `SubagentStop` hook in `.claude/settings.json` that runs `scripts/validate-session-log.mjs`. The validator:

- Identifies whether the stopping subagent is a domain expert (has both `.claude/agents/<name>.md` and `.claude/agent-memory/<name>/`)
- Scans the subagent's transcript for a `Write` or `Edit` to `agent-memory/<name>/logs.md` during the session
- Re-reads `logs.md` and requires all three markers: `Bottleneck`, `Counterfactual`, `Patch`
- Exits 2 with a blocking message if either check fails, forcing the subagent to loop back and actually write the entry before it can end
- No-ops (exit 0) for non-domain-expert subagents so it does not interfere with general-purpose agents

Run the installer — it is idempotent, preserves other hooks, and creates `settings.json` if missing:

```bash
node .claude/skills/create-codebase-expert/scripts/install-hook.mjs
```

It prints either `installed …` or `already present …`. Require exit 0. Subsequent agent creations will detect the hook already present and no-op.

### 6. Verify

Confirm the layout exists:

```
.claude/agents/<name>.md
.claude/agent-memory/<name>/
├── knowledge.md
└── logs.md
```

Then run the scaffold validator and require exit 0 before proceeding:

```bash
node .claude/skills/create-codebase-expert/scripts/validate-scaffold.mjs <name>
```

The validator deterministically checks: YAML frontmatter parses, required fields present (`name`, `description`, `model`, `color`, `memory`, `tools`, `maxTurns`), `name` matches filename, `description` starts with "Use this agent when", `color` is unique across existing agents, `tools` is a non-empty subset of the known Claude Code tool allowlist (plus any `mcp__*`), memory files exist, and the spec body contains all 7 required H2 section headings.

If the validator reports errors, fix them and re-run before reporting completion. Do not skip this step.

### 7. Report

Tell the user:

- Agent name and spec file path
- Domain boundary (own / not own)
- Memory directory path

## Examples

✓ Good boundary (layer appears in name):

```
/create-codebase-expert chat-backend-developer
Owns: packages/convex/chat/*, convex schema for messages/threads
Does NOT own: apps/mirror/src/chat/** (frontend), Tavus integration
```

✗ Bad boundary (ambiguous — implies end-to-end ownership it doesn't have):

```
/create-codebase-expert chat-agent
Owns: "chat stuff"
```

## Anti-patterns

- **Don't pre-fill knowledge.** Speculation degrades future sessions. Knowledge grows through patches driven by real session bottlenecks.
- **Don't add more memory files.** The whole system is `knowledge.md` + `logs.md`. If you want to track something else, you're solving the wrong problem.
- **Don't paraphrase the 4 objectives or reorder them.** The ordering is load-bearing.
- **Don't overlap with existing agents.** Two agents owning the same file produces contradictory patches.
- **Don't write a long agent spec.** If the spec is growing past \~80 lines, the content belongs in `knowledge.md` instead.
- **Don't skip the log & patch step.** A session that ends without a log entry has broken the self-improvement contract.
