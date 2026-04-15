---
name: create-skill
description: Scaffolds new project skills in .claude/skills/ using the repo's standard SKILL.md template (frontmatter + Scope & non-goals, Quick start, Workflow, Examples, References, Anti-patterns). Use when the user asks to create, scaffold, author, or add a new skill, says "new skill", "make a skill", or wants to turn a repeated workflow into a reusable skill. Also use when auditing an existing skill against the template.
---

# Skill Creator

Author new skills for this repo that follow Anthropic's skill-authoring best practices and this project's conventions. The goal is skills Claude can reliably discover, load cheaply, and execute without drift.

## Scope & non-goals

**Do NOT use for**: one-off prompts, personal memory entries (use auto-memory), automation that requires hooks (use `update-config`), or CLAUDE.md edits.

## Quick start

1. Clarify the brief (purpose, triggers, 80% workflow) **and grep `.claude/skills/` for overlap** — stop if an existing skill already covers it.
2. `python3 .claude/skills/create-skill/scripts/init_skill.py <skill-name>` — scaffolds from the template, enforces naming rules.
3. Fill frontmatter + body; delete any section without real content. Extract artifacts >20 lines into `{name}-template/`.
4. `python3 .claude/skills/create-skill/scripts/validate_skill.py .claude/skills/<skill-name>` — must exit 0.
5. Run [`audit-skill`](../audit-skill/SKILL.md) against the new skill — the validator only catches mechanics, audit-skill catches semantic drift (vague description, empty-in-prose sections, name-intent mismatch). Must return zero blockers before reporting done.

Full expanded procedure in [Workflow](#workflow). Package for distribution (optional): `scripts/package_skill.py <skill-dir>`.

## Tooling

Three scripts enforce the conventions in this doc. Prefer them over hand-scaffolding.

| Script                                                 | Purpose                                                                                                                                                                         | Usage                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [scripts/init_skill.py](scripts/init_skill.py)         | Scaffold a new skill from `skill-template/SKILL.md`. Validates name against `^[a-z0-9-]+$`, ≤64 chars, no reserved words.                                                       | `init_skill.py <name> [--path .claude/skills]` |
| [scripts/validate_skill.py](scripts/validate_skill.py) | Check frontmatter, name↔directory match, description length/triggers, body ≤500 lines, inline-block size, nested refs, time-stamped prose. Errors → exit 1; warnings → exit 0. | `validate_skill.py <skill-dir>`                |
| [scripts/package_skill.py](scripts/package_skill.py)   | Validate then zip the skill into a distributable `.skill` file.                                                                                                                 | `package_skill.py <skill-dir> [output-dir]`    |
| [evals/run_evals.py](evals/run_evals.py)               | Lint the fixture schema and print each scenario's expected/forbidden behaviors. Walk through before merging changes to this skill.                                              | `evals/run_evals.py [--lint]`                  |

Run `validate_skill.py` after every edit — it's the fast feedback loop.

## Template

Canonical scaffold lives at [skill-template/SKILL.md](skill-template/SKILL.md). `init_skill.py` copies it for you. Fill in placeholders and delete sections that don't apply.

**Artifact convention:** Any bundled artifact (template, script, example file) goes in a `{artifact-name}-template/` or similarly-named subdirectory of the skill and is referenced from `SKILL.md`. Never inline artifacts larger than ~20 lines.

**Dependency direction is strictly upward.** Templates reference nothing; skills reference templates; agents reference skills. No file references anything "above" it. If two files reference each other, remove the downward link — skills describe _what work happens_, not _who does it_. Templates live in exactly one place, under `{artifact-type}-template/` inside the owning skill.

**Sub-agent convention:** Prompts for sub-agents that exist only to run this skill's workflow live in `agents/<role>.md` inside the skill directory. Sub-agents already registered in `.claude/agents/` are referenced by name instead — never copied. Rule of thumb: if deleting the skill would orphan the prompt, it belongs in the skill's `agents/`; otherwise it belongs in `.claude/agents/`.

## Authoring rules

1. **Frontmatter is the discovery surface.** `name` + `description` are the only tokens pre-loaded. Description must be third-person, include _what_ and _when_, and name concrete trigger phrases. Max 1024 chars — every token competes with every other skill's metadata. Include an `argument-hint` field when the skill accepts input (e.g. `"[skill-name]"`, `"[ticket-id]"`); delete the line if the skill takes no arguments.
2. **Naming convention: gerund form** (verb + `-ing`), lowercase, hyphen-separated. Examples: `creating-tickets`, `reviewing-prs`, `scaffolding-components`, `processing-pdfs`. The gerund aligns the skill's identity with the user's intent verb, which is how Claude matches triggers. Noun names (`tickets`, `pdf-helper`) force an extra inference hop and invite scope creep.

   - **Constraints**: `^[a-z0-9-]+$`, ≤64 chars, no reserved words (`anthropic`, `claude`).
   - **Directory name must equal frontmatter `name`** — location already namespaces the skill, so don't prefix.
   - **Acceptable fallbacks**: action form (`configure-settings`) or tool-action (`sentry-cli`, `tavus-cvi-quickstart`) when the tool name is the primary trigger.
   - **Avoid**: `helper`, `utils`, `tools`, version suffixes (`v2-...`), filler verbs (`do-stuff-with-...`), CamelCase.
   - **Do not mass-rename existing skills.** Apply this to new skills and rename opportunistically — churn costs more than inconsistency.

   > **Meta-skill exception.** Skills whose primary surface _is_ a tool or artifact concept (`create-skill`, `audit-skill`, `create-spec`) may use `<action>-<noun>` or `<noun>-<action>` form — the tool name carries stronger trigger signal than a forced gerund. This skill (`create-skill`) is itself an instance of the exception.

3. **Omit empty sections.** The template is a ceiling, not a floor. A 40-line skill should be 40 lines.
4. **No progressive disclosure under ~150 lines.** Splitting small skills into multiple files adds navigation cost without token savings.
5. **References stay one level deep from SKILL.md.** Claude partially-reads nested files and loses info.
6. **Match freedom to fragility.** High freedom (heuristics) for open-ended tasks, low freedom (exact commands) for fragile ones like migrations.
7. **No time-sensitive language** (calendar years, "as of [year]", "currently in [quarter]"). Put deprecated patterns under a collapsed "Old patterns" section.
8. **Consistent terminology** within the skill — pick one term and stick to it.
9. **Don't explain what Claude already knows.** Every paragraph must justify its token cost.

## Workflow

```
- [ ] 1. Clarify brief (purpose, triggers, 80% workflow, scope boundaries)
- [ ] 2. Overlap check — grep .claude/skills/*/SKILL.md for trigger phrases
- [ ] 3. Pick a name (gerund form, or meta-skill exception)
- [ ] 4. Scaffold via init_skill.py
- [ ] 5. Write frontmatter + draft body
- [ ] 6. Run validate_skill.py — fix every error
- [ ] 7. Run audit-skill — resolve every blocker
- [ ] 8. Report to the user (one sentence)
```

Steps 1-4 are summarized in [Quick start](#quick-start). Detail below covers the steps where skills most commonly fail.

### Step 1 — Clarify the brief

Extract four things before touching the filesystem: purpose (one sentence), trigger phrases, the 80% workflow, scope boundaries. Ask if any are missing — don't invent them. Skills built from vague briefs mis-activate. Eval fixture: [`evals/03-vague-brief.json`](evals/03-vague-brief.json).

### Step 2 — Overlap check (the #1 failure mode)

Grep `.claude/skills/*/SKILL.md` for every trigger phrase from step 1. If an existing skill already covers them, **stop and propose editing that skill** — do not create a near-duplicate under a slightly different name. Only proceed on a clean "no existing skill covers this." Eval fixture: [`evals/02-overlap-trap.json`](evals/02-overlap-trap.json).

### Step 3 — Name examples

✓ Good: `creating-tickets`, `reviewing-prs`, `scaffolding-components`, `processing-pdfs`
✓ Meta-skill exception: `create-skill`, `audit-skill`, `create-spec`, `maintain-agents-md`
✗ Bad: `helper`, `utils`, `claude-tools`, `tickets-v2`, `TicketCreator`

### Step 4 — Frontmatter examples

✓ Good (specific, third-person, triggers named):

```yaml
---
name: generating-commit-messages
description: Generates Conventional Commit messages from staged git diffs. Use when the user asks to commit, says "commit this", or wants a PR-ready message.
---
```

✗ Bad (vague, first-person, no triggers):

```yaml
---
name: commit-helper
description: I help you with git stuff
---
```

### Step 5 — Draft the body

**Input:** The frontmatter from step 4 and the workflow brief from step 1.
**Process:** Copy [skill-template/SKILL.md](skill-template/SKILL.md) verbatim, then fill in placeholders. Delete any section that has no real content — empty sections train Claude to skim. Extract any artifact longer than ~20 lines into `{artifact-name}-template/` and reference it.
**Output:** A SKILL.md body under 500 lines, with only the sections that carry weight.

### Step 6 — Verify with validate_skill.py

**Input:** The skill directory.
**Process:** Run `scripts/validate_skill.py <skill-dir>`. It checks frontmatter delimiters, `name` vs directory, description length + trigger phrase hint, body ≤500 lines, inline blocks ≤20 lines, nested-reference depth, and time-stamped prose. Fix every error before proceeding. Warnings are advisory but should be read.
**Output:** Exit 0 required to continue. On fail, fix and re-run — don't skip.

### Step 7 — Audit pass

**Input:** The validated skill directory.
**Process:** Invoke [`audit-skill`](../audit-skill/SKILL.md) against the new skill. The validator is mechanical (frontmatter, line counts, nested refs); the audit is semantic (description vagueness, name-intent mismatch, empty-in-prose sections, artifact placement). Address every blocker. Warnings are advisory.
**Output:** Zero blockers. If audit surfaces a recurring gap, patch the upstream rule in this SKILL.md _before_ fixing the downstream skill — compound the improvement.

### Step 8 — Report

**Input:** The verified file path.
**Process:** Write a single sentence to the user.
**Output:** Path + one-line description of what the skill does and how to invoke it. No file summary, no contents dump.

✓ Good: `Created .claude/skills/generating-commit-messages/SKILL.md — triggers on "commit this" and drafts Conventional Commit messages from staged diffs.`
✗ Bad: `I've created a new skill for you! It has the following sections: Scope & non-goals, Quick start, Workflow, Examples...`

## Examples

Names — ✓ good: `creating-tickets`, `reviewing-prs`, `scaffolding-components`. ✓ meta-skill exception: `create-skill`, `create-spec`. ✗ bad: `helper`, `utils`, `tickets-v2`, `TicketCreator`.

Frontmatter — ✓ good:

```yaml
---
name: generating-commit-messages
description: Generates Conventional Commit messages from staged git diffs. Use when the user asks to commit, says "commit this", or wants a PR-ready message.
---
```

✗ bad: `name: commit-helper`, `description: I help you with git stuff` (vague, first-person, no triggers).

See [Workflow](#workflow) step 3–4 for the reasoning behind each.

## Anti-patterns

- **Filling every section because the template has it.** Empty sections train Claude to skim. Delete them.
- **Description as marketing copy.** Every padded word displaces another skill's metadata at discovery time.
- **Premature file splitting.** A 120-line skill in 4 files costs more round-trips than it saves tokens.
- **Nested references** (`SKILL.md → advanced.md → details.md`). Claude partial-reads these and misses content. Flat-link from SKILL.md.
- **Copy-paste from another skill without trimming.** Inherited boilerplate is the fastest way to dilute trigger signal.
- **Time-stamped prose** (calendar years in guidance text). Rots immediately.
- **Skill that duplicates CLAUDE.md rules.** If it's always-on guidance, it belongs in CLAUDE.md or `.claude/rules/`, not a skill.
