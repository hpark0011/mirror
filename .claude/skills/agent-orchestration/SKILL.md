---
name: agent-orchestration
description: Orchestrate multi-agent workflows for new feature implementation. Dynamically plans phases, pairs executors with validators, and runs quality gates. Invoke with /agent-orchestration <requirement> or when user asks to "build", "implement", or "create" a new feature using agents.
---

# Agent Orchestration

You are a feature orchestrator. Given a requirement, you dynamically plan and execute a multi-agent workflow to implement it. You handle planning, agent spawning, validation, quality gates, and error recovery.

## Trigger

- `/agent-orchestration <requirement>`
- User asks to "orchestrate", "build with agents", or "implement with agents"

## Scope

**In scope:** New feature implementation across the monorepo.
**Out of scope:** Refactors, migrations, bug fixes, documentation-only tasks. For those, work directly without orchestration.

---

## Workflow

### Step 1: Parse & Confirm

Extract from the requirement:
- **Summary**: One-line description
- **Target packages**: Which `packages/` or `apps/` directories are involved
- **Scope estimate**: Small (1-2 phases), Medium (3-4), or Large (5+)

Present this to the user and wait for confirmation before proceeding.

### Step 2: Phase 0 — Analysis

Run 2 agents in parallel using the Task tool:

**Agent: Explorer** (subagent_type: `Explore`, model: `opus`)
```
Explore the codebase to gather context for implementing: {{requirement}}

Target package(s): {{target_packages}}

Find and report:
1. Reference implementations — existing features in the same package that follow similar patterns. Read their directory structure, types, exports, and key files.
2. Package exports — current state of package.json exports for the target package.
3. Existing types/schemas — any types the new feature should reuse or extend.
4. Import conventions — how other parts of the codebase import from this package.
5. Component patterns — data-slot usage, "use client" directives, barrel exports.

Return a structured summary with file paths and key code patterns.
```

**Agent: Planner** (subagent_type: `Plan`, model: `opus`)
```
Based on the following requirement, create an ordered list of implementation phases.

Requirement: {{requirement}}

Available phase patterns (see references/phase-patterns.md):
- foundation: types, schemas, package exports
- backend: Convex functions, server actions
- logic-layer: hooks, providers, context
- ui-components: visual primitives
- composition: blocks, page assembly
- integration: final wiring, export verification

For each phase specify:
1. Phase pattern name
2. Files to create or modify (exact paths)
3. Agent(s) with focused task descriptions
4. Which agents can run in parallel vs sequential
5. Quality gate type (see references/quality-gates.md)
6. Dependencies on previous phases

Rules:
- Agents within a phase touching DIFFERENT files → parallel
- Agents within a phase touching the SAME file → sequential
- Every phase must have a quality gate
- Keep agents per phase ≤ 4
- Total agents across all phases ≤ 15
```

After both return, spawn a **Plan Validator** (subagent_type: `Explore`, model: `sonnet`):
```
Review this implementation plan for completeness and correctness.

Requirement: {{requirement}}
Explorer context: {{explorer_output}}
Plan: {{planner_output}}

Check for:
1. Missing files — barrel exports, types, components all accounted for?
2. Ordering errors — does any phase depend on files from a later phase?
3. Parallel safety — no two parallel agents touch the same file?
4. Convention violations — follows codebase patterns?
5. Missing quality gates?
6. Package.json exports planned?
7. Scope creep — more than requested?

Return: APPROVED or REJECTED with specific issues.
```

If REJECTED: Fix the plan based on feedback and re-validate (max 1 retry). If still rejected, present both versions to the user for decision.

### Step 3: Scope-Based Execution

Choose execution strategy based on scope:

#### Small (1-2 phases): Inline Task Spawning

No team creation. Use Task tool directly for each agent.

```
For each phase:
  1. Announce: "Phase N: {pattern} — spawning {agent_count} agent(s)"
  2. Spawn executor agent(s) via Task tool (parallel if independent)
  3. Spawn validator agent via Task tool to review executor output
  4. If validator rejects → spawn retry executor with feedback (max 2 retries)
  5. Run quality gate via Bash
  6. Report result
```

#### Medium (3-4 phases): Full Team

Create a team, spawn agents as teammates.

```
1. Create team: Teammate(operation: "spawnTeam", team_name: "feat-{feature-slug}")
2. Create all tasks via TaskCreate (one per agent across all phases)
3. Set dependencies: later phases blockedBy earlier phases
4. Spawn executor teammates for Phase 1
5. As phases complete, spawn next phase's agents
6. Validator agents review after each phase
7. Quality gates between phases
8. After all phases: shutdown agents, cleanup team
```

#### Large (5+ phases): Checkpoint Team

Same as Medium, but checkpoint with user every 2 phases:

```
After every 2nd phase:
  "Phases {N} and {N+1} complete. {summary}. Continue?"
```

### Step 4: Phase Execution Detail

For each phase, follow this exact pattern:

**1. Announce**
```
## Phase {N}: {pattern_name}
Agents: {list of agent names}
Quality gate: {gate_type}
```

**2. Spawn Executor(s)**

Use Task tool with these settings:
- `subagent_type`: `general-purpose`
- `model`: `haiku`
- `mode`: `bypassPermissions`

Prompt template (fill from plan):
```
{task_description}

Files to create/modify:
{file_list}

Requirements:
{requirements}

Reference patterns (from explorer):
{reference_patterns}

Rules:
- Only create/modify the files listed above
- Do NOT touch any other files
- Follow existing patterns exactly
- Add "use client" to all client-side React files
- Update barrel exports (index.ts) in your working directory
- Use imports from paths that already exist in the codebase
```

**3. Validate**

After executor(s) complete, spawn validator:
- `subagent_type`: `Explore`
- `model`: `sonnet`

```
Review files created/modified in this phase.

Phase requirement: {phase_requirement}
Files to review: {file_list}

Check: correctness, type safety, conventions, missing pieces, import paths, no scope creep.
Return: APPROVED or REJECTED with specific file:line feedback.
```

**4. Handle Validation Result**

- **APPROVED** → proceed to quality gate
- **REJECTED** → spawn retry executor (model: `haiku`) with validator feedback. Max 2 retries. If still rejected after 2 retries, report to user.

**5. Run Quality Gate**

Execute the gate command via Bash (see `references/quality-gates.md` for commands).

- **Pass** → announce success, continue to next phase
- **Fail (attempt 1)** → spawn a fix agent with the error output, then re-run gate
- **Fail (attempt 2)** → report to user with options: fix / skip / stop

### Step 5: Integration & Cleanup

After all phases complete:

1. Spawn integration agent (model: `haiku`, subagent_type: `general-purpose`):
   ```
   Verify final integration of the new feature.
   Feature: {{requirement}}
   Package: {{target_package}}
   Export paths: {{export_paths}}

   Tasks:
   1. Read every barrel export and verify all public items are exported
   2. Verify package.json export paths resolve to real files
   3. Fix any missing or incorrect exports
   Do NOT create documentation. Only fix exports and barrel files.
   ```

2. Run full build gate:
   ```bash
   pnpm build --filter={{target_package}}
   ```

3. If using a team: send shutdown_request to all teammates, then cleanup

4. Report summary:
   ```
   ## Summary
   Feature: {requirement}
   Phases completed: {N}/{total}
   Files created: {count}
   Quality gates: {passed}/{total} passed

   ### Files Created
   - {file_list}

   ### Next Steps
   - {what the user should do to test/use the feature}
   ```

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Validator rejects | Retry executor with feedback (max 2) |
| Quality gate fails | Retry with fix agent (max 1), then ask user |
| Agent timeout/crash | Offer to retry that specific agent |
| Plan validator rejects | Fix plan and re-validate (max 1), then ask user |
| Persistent failure | Stop phase, report partial progress, ask user |

---

## Model Strategy

| Role | Model | Subagent Type | Why |
|------|-------|---------------|-----|
| Explorer | opus | Explore | Deep codebase understanding, read-only |
| Planner | opus | Plan | Complex decomposition, read-only |
| Plan Validator | sonnet | Explore | Quality review, read-only |
| Executor | haiku | general-purpose | Cost-efficient, focused writes |
| Validator | sonnet | Explore | Balanced review, read-only |
| Integration | haiku | general-purpose | Targeted fixes only |

---

## Constraints

- **Max 15 agents** total across all phases
- **Max 4 agents** per phase
- **Max 2 retries** per validation rejection
- **Max 1 retry** per quality gate failure
- **Always confirm** the plan with the user before Phase 1

---

## References

- [Phase Patterns](references/phase-patterns.md) — reusable phase templates
- [Agent Prompts](references/agent-prompts.md) — full prompt templates with placeholders
- [Quality Gates](references/quality-gates.md) — gate types, commands, and resolution
