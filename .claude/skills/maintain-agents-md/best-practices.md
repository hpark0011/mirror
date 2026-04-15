# CLAUDE.md Best Practices

Reference material for creating and reviewing CLAUDE.md files. Aligned with the official Claude Code memory docs: https://code.claude.com/docs/en/memory

## Core Principles

### Keep It Small

- **Target: under 200 lines per CLAUDE.md file.** Longer files consume more context and reduce adherence.
- CLAUDE.md is loaded in full at session start — every line competes with the actual task for attention.
- If instructions grow past ~200 lines, split via `@imports` or `.claude/rules/` (see below).

### Be Specific and Verifiable

Concrete instructions outperform vague ones:

- "Use 2-space indentation" instead of "Format code properly"
- "Run `pnpm test` before committing" instead of "Test your changes"
- "API handlers live in `src/api/handlers/`" instead of "Keep files organized"

### Structure with Markdown

Use headers, bullets, and tables to group related instructions. Claude scans structure like a reader — organized sections are followed more reliably than dense paragraphs.

### Stay Consistent

If two rules contradict each other (across files or within one), Claude may pick arbitrarily. Review ancestor CLAUDE.md files and `.claude/rules/` periodically to remove stale or conflicting instructions.

### Solve Real Problems

Add to CLAUDE.md when:

- Claude makes the same mistake twice
- You type the same correction a second time
- A new teammate would need the same context to be productive
- A code review catches something Claude should have known

---

## File Locations

| Scope                | Location                                                  | Purpose                             |
| -------------------- | --------------------------------------------------------- | ----------------------------------- |
| **Managed policy**   | OS-specific system path (`/Library/...`, `/etc/...`)      | Org-wide instructions (IT-deployed) |
| **Project**          | `./CLAUDE.md` **or** `./.claude/CLAUDE.md`                | Team-shared, checked into git       |
| **User**             | `~/.claude/CLAUDE.md`                                     | Personal, applies to all projects   |
| **Local (personal)** | `./CLAUDE.local.md` (gitignored)                          | Per-project personal preferences    |

CLAUDE.md files in ancestor directories are loaded in full at launch. Files in subdirectories load **on demand** when Claude reads files in those directories. More specific files override broader ones.

---

## What Belongs in CLAUDE.md

### Must Include

| Element         | Example                              |
| --------------- | ------------------------------------ |
| Project context | "Next.js e-commerce app with Stripe" |
| Build command   | `pnpm build`                         |
| Test command    | `pnpm test`                          |
| Lint command    | `pnpm lint`                          |
| Dev server      | `pnpm dev`                           |

### Include If Relevant

- Gotchas and warnings ("don't modify `src/legacy`")
- Brief architecture overview (module relationships, data flow)
- Workflow rules (branch naming, PR process, deploy steps)
- Pointers to deeper docs (`@docs/architecture.md`) rather than inlined content

### Never Include

- Things linters/formatters already enforce
- Generic programming advice Claude already knows
- Verbose explanations when terse ones suffice
- Duplicated instructions
- Full style guides — link or extract key rules only
- Edge-case instructions that rarely trigger — move to skills or path-scoped rules

---

## Splitting Large Files

When a CLAUDE.md grows past ~200 lines, split it using one of these mechanisms.

### `@path` imports

CLAUDE.md supports `@path/to/file` syntax. Imported files expand inline at launch. Relative paths resolve relative to the importing file. Max depth: 5 hops.

```markdown
See @README.md for project overview and @package.json for commands.

## Workflow
- Git rules: @docs/git-instructions.md
- Personal prefs: @~/.claude/my-preferences.md
```

Use `@~/.claude/...` imports to share personal instructions across git worktrees (a gitignored `CLAUDE.local.md` only exists in the worktree where it was created).

### `.claude/rules/` directory

For modular, topic-based organization (preferred for larger projects):

```
your-project/
├── CLAUDE.md
└── .claude/
    └── rules/
        ├── testing.md
        ├── api-design.md
        └── security.md
```

Rules without frontmatter load at launch alongside CLAUDE.md. Rules with a `paths:` frontmatter are **path-scoped** — they only load when Claude reads matching files, keeping context clean:

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{tsx,ts}"
---

# API Development Rules
- All endpoints must validate input
- Use the standard error response format
```

### Skills vs rules vs CLAUDE.md

| Mechanism       | Loaded                                   | Use for                                |
| --------------- | ---------------------------------------- | -------------------------------------- |
| CLAUDE.md       | Every session, in full                   | Always-true project facts              |
| `.claude/rules/*.md` (unscoped) | Every session                | Topic modules you want always-on       |
| `.claude/rules/*.md` (path-scoped) | When matching files opened | Directory- or file-type-specific rules |
| Skills          | On invocation / relevance                | Multi-step procedures, workflows       |

---

## AGENTS.md Interop

Claude Code reads `CLAUDE.md`, not `AGENTS.md`. If the repo already uses `AGENTS.md` for other agents, make `CLAUDE.md` a one-line import so both tools share a single source of truth:

```markdown
@AGENTS.md

## Claude Code
Use plan mode for changes under `src/billing/`.
```

---

## Maintainer Notes via HTML Comments

Block-level HTML comments are **stripped** from CLAUDE.md before injection into context. Use them for notes to human maintainers without spending tokens:

```markdown
<!-- Last reviewed 2026-04-15 — bump version section when upgrading to pnpm 10 -->
## Commands
...
```

Comments inside fenced code blocks are preserved. Comments stay visible when the file is read directly via the Read tool.

---

## Anti-Patterns

| Pattern                      | Problem                            | Fix                                 |
| ---------------------------- | ---------------------------------- | ----------------------------------- |
| "Format code properly"       | Vague, Claude knows this           | Delete or specify formatter command |
| Listing every file/directory | Bloats context, changes frequently | Describe structure conceptually     |
| Copy-pasted style guides     | Too long, drowns signal            | Link or extract key rules           |
| Edge case instructions       | Rarely triggered, always loaded    | Move to skills or path-scoped rules |
| Overusing "Always", "Never"  | Weakens real must-dos              | Remove unless truly critical        |
| Auto-generated content       | Verbose, generic                   | Hand-craft for best results         |
| Duplicating AGENTS.md        | Drift between files                | Use `@AGENTS.md` import             |

---

## Quality Metrics

### Size

- **Good:** under 200 lines
- **Warning:** 200–300 lines — consider splitting
- **Critical:** over 300 lines — split via imports or `.claude/rules/`

### Completeness Checklist

- [ ] Can Claude build without asking?
- [ ] Can Claude test without asking?
- [ ] Can Claude lint without asking?
- [ ] Is project purpose clear in one line?
- [ ] Are critical gotchas documented?

### Accuracy Checklist

- [ ] Do all commands actually exist and work?
- [ ] Do all referenced directories exist?
- [ ] Do conventions match current code?
- [ ] Are tool versions current?
- [ ] Are `@imports` resolvable (no max-depth violations)?

---

## Output Templates

### New CLAUDE.md

```markdown
# Project Name

Brief description (one line).

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm test` — run tests
- `pnpm lint` — lint and fix

## Structure

- `src/app` — pages and routes
- `src/lib` — shared utilities
- `src/components` — React components

## Conventions

- Use named exports
- Colocate tests with source (`*.test.ts`)

## Do Not

- Modify `src/generated` (auto-generated)
- Commit directly to main
```

### Review Report

```markdown
## CLAUDE.md Review

**Score: X/10**

One-sentence summary.

### Issues

1. **[High]** Issue description
   - Line/section: X
   - Problem: What's wrong
   - Fix: Concrete rewrite

### Suggestions

- Actionable improvement with example

### Working Well

- Positive patterns to preserve
```

---

## Monorepo Considerations

Use nested CLAUDE.md files per workspace:

```
repo/
├── CLAUDE.md              # Shared conventions, repo-wide commands
├── apps/
│   ├── web/
│   │   └── CLAUDE.md      # Web app specific
│   └── api/
│       └── CLAUDE.md      # API specific
└── packages/
    └── shared/
        └── CLAUDE.md      # Shared package specific
```

Subdirectory CLAUDE.md files load on demand when Claude reads files in those directories.

**Root file:** repo-wide commands, shared conventions, pointers to app-specific files.
**Child files:** app-specific commands, local gotchas, directory-specific conventions.

If ancestor CLAUDE.md files from other teams pollute context, use the `claudeMdExcludes` setting in `.claude/settings.local.json`:

```json
{
  "claudeMdExcludes": [
    "**/monorepo/other-team/CLAUDE.md",
    "/abs/path/to/other-team/.claude/rules/**"
  ]
}
```

Managed-policy CLAUDE.md files cannot be excluded.

---

## Compaction Behavior

- **Root-project CLAUDE.md survives `/compact`** — Claude re-reads it from disk.
- **Nested CLAUDE.md files do not** auto-reload after compact; they reload next time Claude reads a file in that subdirectory.
- Instructions given only in conversation are lost on compact — move durable ones into CLAUDE.md.
