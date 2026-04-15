---
name: maintain-agents-md
description: Creates, reviews, and updates AGENTS.md and CLAUDE.md project-instructions files. Use when the user says "create an AGENTS.md", "create a CLAUDE.md", "review my AGENTS.md", "audit AGENTS.md", "update AGENTS.md", "bootstrap project instructions", or wants to optimize persistent project instructions for context efficiency. Aligned with the official Claude Code memory docs (200-line target, @imports, .claude/rules/, AGENTS.md interop pattern).
---

# maintain-agents-md

Creates and reviews AGENTS.md and CLAUDE.md project-instructions files. Goal: maximum agent effectiveness with minimum context consumption.

In this repo (and many others) the canonical project-instructions file is `AGENTS.md`, and `CLAUDE.md` is a one-line `@AGENTS.md` import so Claude Code and other agent tools read the same source. This skill handles both artifacts and the interop pattern between them.

## When to use

- User asks to create, review, audit, or update a CLAUDE.md file.
- A CLAUDE.md has grown past ~200 lines and needs splitting into `@imports` or `.claude/rules/`.
- User wants to bootstrap project instructions for a new repo (`/init` alternative with repo-specific conventions).
- A code review or session surfaces drift between CLAUDE.md and the actual codebase.

**Do NOT use for**: editing skills (use `create-skill` / `audit-skill`), writing task-specific workflows (use a skill or `.claude/rules/` path-scoped file), or auto-memory — that's Claude Code's own mechanism, not user-authored.

## Quick start

1. **Read `best-practices.md` first** — it's the reference for every task in this skill (size targets, locations, imports, `.claude/rules/`, AGENTS.md interop, anti-patterns).
2. Pick the workflow file that matches the task:
   - New file → `create-claude-md.md`
   - Review existing → `review-claude-md.md`
   - Targeted update → `update-claude-md.md`
3. Follow that workflow end to end. Verify every command you emit actually exists in the target repo before including it.

## Workflow

```
- [ ] 1. Load best-practices.md into context
- [ ] 2. Identify task: create / review / update
- [ ] 3. Open the matching workflow file and execute its steps
- [ ] 4. Verify every command and path referenced in the output exists in the repo
- [ ] 5. Keep the resulting CLAUDE.md under 200 lines; split via @imports or .claude/rules/ if over
- [ ] 6. If the repo uses AGENTS.md, make CLAUDE.md a one-line @AGENTS.md import plus Claude-specific overrides
- [ ] 7. Report: file path, line count, any split decisions, any gotchas surfaced
```

### Workflow files

- `create-claude-md.md` — Analyze codebase, generate new CLAUDE.md
- `review-claude-md.md` — Audit existing file, return scored feedback
- `update-claude-md.md` — Apply targeted updates to an existing file

## Examples

✓ Good create output: terse CLAUDE.md under 200 lines with real commands, one-line purpose, project-specific gotchas, and `@AGENTS.md` import if applicable.

✓ Good review output: scored report with line-referenced issues, concrete rewrites, and a list of rules that should move into `.claude/rules/` with `paths:` frontmatter.

✗ Bad create output: generic "use good practices" advice, commands copied from a template without verifying they exist, 400-line file that duplicates AGENTS.md.

✗ Bad review output: "looks mostly fine, a few small things" with no line numbers or severity.

## Anti-patterns

- **Ignoring the 200-line target.** Files over 200 lines consume more context and reduce adherence — split via `@imports` or `.claude/rules/`.
- **Inventing commands.** Never emit a build/test/lint command without verifying it exists in `package.json` / `Makefile` / equivalent.
- **Duplicating AGENTS.md.** If the repo has AGENTS.md, import it via `@AGENTS.md` instead of copy-pasting.
- **Inlining full style guides.** Link or extract the one or two load-bearing rules. Leave the rest in the source doc.
- **Writing edge-case rules into CLAUDE.md.** Move rarely-triggered rules into path-scoped `.claude/rules/*.md` so they only load when relevant.
- **Dropping `<!-- maintainer notes -->` into CLAUDE.md expecting Claude to see them.** Block-level HTML comments are stripped before injection — useful for human notes, invisible to Claude.

## References

- `best-practices.md` — size, structure, locations, imports, rules, AGENTS.md interop, compaction behavior
- `create-claude-md.md` — new-file workflow
- `review-claude-md.md` — audit workflow
- `update-claude-md.md` — targeted-update workflow
- Official docs: https://code.claude.com/docs/en/memory
