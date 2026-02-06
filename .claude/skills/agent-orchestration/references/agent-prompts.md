# Agent Prompt Templates

Templates for agent prompts. The orchestrator fills in `{{placeholders}}` when spawning agents.

---

## Explorer Agent (Phase 0)

**Model:** opus | **Subagent type:** Explore

```
Explore the codebase to gather context for implementing: {{requirement}}

Target package(s): {{target_packages}}

Find and report:
1. Reference implementations — existing features in the same package that follow similar patterns. Read their directory structure, types, exports, and key files.
2. Package exports — current state of package.json exports for the target package.
3. Existing types/schemas — any types the new feature should reuse or extend.
4. Import conventions — how other parts of the codebase import from this package.
5. Component patterns — data-slot usage, "use client" directives, barrel exports.

Return a structured summary with file paths and key code patterns. Do NOT suggest implementation — just report what exists.
```

---

## Planner Agent (Phase 0)

**Model:** opus | **Subagent type:** Plan

```
Based on the following requirement and codebase context, create an ordered list of implementation phases.

Requirement: {{requirement}}

Codebase context:
{{explorer_output}}

Available phase patterns: foundation, backend, logic-layer, ui-components, composition, integration

For each phase, specify:
1. Phase pattern name (from the list above)
2. Files to create or modify (exact paths)
3. Agent(s) needed with their focused task description
4. Which agents can run in parallel vs must be sequential
5. Quality gate type: type-check, lint, type-check-and-lint, full-build, or app-compile
6. Dependencies on previous phases

Rules:
- Agents within a phase that touch DIFFERENT files can run in parallel
- Agents within a phase that touch the SAME file must be sequential
- Every phase must have a quality gate
- Keep agent count per phase ≤ 4
- Total agents across all phases ≤ 15
- Prefer fewer, focused agents over many granular ones
```

---

## Plan Validator Agent (Phase 0)

**Model:** sonnet | **Subagent type:** Explore

```
Review this implementation plan for completeness and correctness.

Requirement: {{requirement}}
Plan: {{planner_output}}

Check for:
1. Missing files — are all necessary barrel exports, types, and components accounted for?
2. Ordering errors — does any phase depend on files created in a later phase?
3. Parallel safety — do any parallel agents within the same phase touch the same file?
4. Convention violations — does the plan follow the codebase's existing patterns?
5. Missing quality gates — every phase needs one.
6. Package.json exports — are all new export paths planned?
7. Scope creep — does the plan create more than what was requested?

Return: APPROVED or REJECTED with specific issues to fix.
```

---

## Executor Agent (Phase N)

**Model:** haiku | **Subagent type:** general-purpose

```
{{task_description}}

Files to create/modify:
{{file_list}}

Requirements:
{{requirements}}

Reference patterns (from codebase):
{{reference_patterns}}

Rules:
- Only create/modify the files listed above
- Do NOT touch any other files
- Follow existing patterns exactly
- Add "use client" directive to all client-side React files
- Update barrel exports (index.ts) in the directory you're working in
- Use imports from the paths that already exist in the codebase
```

---

## Validator Agent (Phase N)

**Model:** sonnet | **Subagent type:** Explore

```
Review the following files that were just created/modified by an executor agent.

Requirement for this phase: {{phase_requirement}}
Files to review: {{file_list}}

Check for:
1. Correctness — does the code fulfill the requirement?
2. Type safety — are types used correctly, no `any`?
3. Convention compliance — "use client", data-slot, barrel exports, naming?
4. Missing pieces — are all required exports present?
5. Import correctness — do imports reference real paths?
6. No scope creep — only the requested files were touched?

Return: APPROVED or REJECTED with specific issues.
If REJECTED, provide exact file paths and line-level feedback the executor can act on.
```

---

## Executor Retry Prompt (after validator rejection)

**Model:** haiku | **Subagent type:** general-purpose

```
Your previous implementation was reviewed and needs fixes.

Validator feedback:
{{validator_feedback}}

Original task:
{{original_task_description}}

Files to fix:
{{file_list}}

Fix ONLY the issues identified by the validator. Do not refactor or add anything else.
Read each file first, then apply targeted fixes.
```

---

## Integration Agent

**Model:** haiku | **Subagent type:** general-purpose

```
Verify the final integration of the new feature.

Feature: {{requirement}}
Package: {{target_package}}
Export paths that should work: {{export_paths}}

Tasks:
1. Read every barrel export (index.ts) and verify all public items are exported
2. Verify package.json export paths resolve to real files
3. Run a mental import check — trace each export path to confirm it reaches a real module
4. Fix any missing or incorrect exports

Do NOT create documentation unless specifically requested.
Do NOT modify component logic — only fix exports and barrel files.
```

---

## Prompt Composition Rules

When the orchestrator fills templates:

1. **{{requirement}}** — the user's original requirement string, verbatim
2. **{{target_packages}}** — derived from the planner's phase plan
3. **{{explorer_output}}** — full output from the explorer agent
4. **{{planner_output}}** — full output from the planner agent
5. **{{file_list}}** — bullet list of exact file paths
6. **{{requirements}}** — bullet list from the phase plan
7. **{{reference_patterns}}** — relevant code snippets from the explorer
8. **{{validator_feedback}}** — the validator's REJECTED response verbatim
9. **{{phase_requirement}}** — the specific task description for this phase
10. **{{original_task_description}}** — the executor's original prompt
11. **{{target_package}}** — the primary package filter name
12. **{{export_paths}}** — list of import paths consumers will use
