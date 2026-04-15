---
name: audit-skill
argument-hint: "[skill-name or .claude/skills/<skill-name>]"
description: Audits an existing skill in .claude/skills/ against the conventions enforced by create-skill — frontmatter shape, naming, section hygiene, artifact placement, and validator compliance. Use when the user says "audit this skill", "review the X skill", "check if this skill follows conventions", "maintain skill", or wants to verify an existing SKILL.md before merging changes. Produces a findings report with concrete fixes, then optionally applies them.
---

# Audit Skill

Assess an existing skill against the authoring rules in [create-skill](../create-skill/SKILL.md). The goal is to catch drift — stale triggers, bloated bodies, nested refs, empty sections — before it degrades discovery or execution.

## Scope & non-goals

**Do NOT use for**: creating new skills (use `create-skill`), editing CLAUDE.md rules, or mass-renaming existing skills (explicitly disallowed by `create-skill` authoring rules). Trigger phrases live in the frontmatter `description`.

## Quick start

1. `python3 .claude/skills/create-skill/scripts/validate_skill.py .claude/skills/<skill-name>` — mechanical checks first.
2. Read the target `SKILL.md` and walk the [Audit checklist](#audit-checklist) against it.
3. Report findings grouped by severity (blocker / warning / nit). Propose concrete edits.
4. If the user approves, apply fixes and re-run `validate_skill.py` until it exits 0.

## Audit checklist

Run each item against the target skill. Every failure becomes a finding.

### Frontmatter (blockers)

- [ ] `name` matches directory name exactly.
- [ ] `name` is `^[a-z0-9-]+$`, ≤64 chars, no reserved words (`anthropic`, `claude`).
- [ ] `description` is third-person, ≤1024 chars, states _what_ AND _when_, names concrete trigger phrases.
- [ ] `description` is not marketing copy, first-person, or vague ("helps with X").

### Naming (warnings)

- [ ] Gerund form (`verb-ing`) OR qualifies for the meta-skill exception (tool/artifact concept like `create-skill`, `audit-skill`, `maintain-agents-md`).
- [ ] No `helper`, `utils`, `tools`, version suffixes, CamelCase, or filler verbs.
- [ ] Not a near-duplicate of an existing skill — grep `.claude/skills/*/SKILL.md` for the trigger phrases.

### Body (blockers)

- [ ] ≤500 lines total.
- [ ] Required H2 sections present, matching `create-skill/skill-template/SKILL.md`: `Scope & non-goals`, `Quick start`, `Workflow`, `Examples`, `Anti-patterns`. `References` is optional. Renaming sections (e.g. `Workflow` → `Process`, or legacy `When to use`) counts as a blocker — the template vocabulary is load-bearing for discoverability.
- [ ] No section is empty or a placeholder ("N/A", "TBD", "REPLACE").
- [ ] No inline code/config block >20 lines — must be extracted into `{artifact}-template/`.
- [ ] No nested references (`SKILL.md → a.md → b.md`). All links one level deep.
- [ ] No time-stamped prose (calendar years, "as of Q2", "currently"). Deprecated patterns live under a collapsed section.
- [ ] Consistent terminology — no synonym drift for core concepts.
- [ ] Does not duplicate CLAUDE.md / `.claude/rules/` content.

### Progressive disclosure (warning)

- [ ] If <150 lines, skill is a single file (no premature splitting).
- [ ] If ≥150 lines, references are flat and justify their existence.

### Artifacts (blocker)

- [ ] Any bundled template/script lives in a `{name}-template/` or `scripts/` subdirectory and is referenced from `SKILL.md`.
- [ ] Prompts for sub-agents that only exist to run this skill's workflow live in `agents/<role>.md`. Sub-agents already registered in `.claude/agents/` must be referenced by name, never copied into the skill.

### Validator (blocker)

- [ ] `validate_skill.py` exits 0. Every error is a blocker; warnings are findings.

## Workflow

```
- [ ] 1. Run validate_skill.py — capture errors + warnings
- [ ] 2. Read SKILL.md end-to-end
- [ ] 3. Walk the audit checklist; record findings with line numbers
- [ ] 4. Group findings: blocker / warning / nit
- [ ] 5. Report to user — propose fixes, don't apply yet
- [ ] 6. On approval, apply fixes and re-run validate_skill.py
- [ ] 7. Stop when validator exits 0 AND all blockers resolved
```

## Examples

✓ Good finding report:

```
audit-skill findings for .claude/skills/foo-bar:

BLOCKERS (2)
- SKILL.md:3 — description is first-person ("I help you...") — rewrite third-person
- SKILL.md:87 — inline YAML block is 34 lines, exceeds 20-line limit — extract to config-template/example.yaml

WARNINGS (1)
- Name "foo-bar" is noun form — consider "processing-foo" gerund (do not mass-rename; apply opportunistically)

Proposed fixes below. Apply? (y/n)
```

✗ Bad report: "Looks mostly fine, a few small things." — not actionable, no line numbers, no severity.

## Anti-patterns

- **Running validator alone and calling it done.** The validator catches mechanics, not semantics (vague descriptions, duplicated skills, empty sections masked as prose).
- **Mass-renaming to enforce gerund form.** Explicitly disallowed by `create-skill` — churn costs more than inconsistency.
- **Proposing fixes for stylistic preferences.** Only flag violations of documented rules in `create-skill/SKILL.md`.
- **Auditing a skill you're also rewriting in the same pass.** Separate the review from the edit — findings lose credibility when entangled with new content.
- **Treating warnings as blockers.** Warnings inform; only documented blockers gate completion.
