# CLAUDE.md Best Practices

Reference material for creating and reviewing CLAUDE.md files.

## Core Principles

### Less Is More

- LLMs follow ~150-200 instructions reliably
- Claude Code's system prompt uses ~50 instructions already
- Every instruction competes for attention with the actual task
- Aim for the minimum instructions that produce correct behavior

### Progressive Disclosure

- Don't front-load everything Claude might need
- Tell Claude _how to find_ information, not all the information itself
- Use skills, commands, and nested CLAUDE.md files for domain-specific context

### Solve Real Problems

- Document commands you'd otherwise repeat every session
- Capture architectural context that takes 10+ minutes to explain
- Establish workflows that prevent rework

---

## What Belongs in CLAUDE.md

### Must Include

| Element         | Example                              |
| --------------- | ------------------------------------ |
| Project context | "Next.js e-commerce app with Stripe" |
| Build command   | `npm run build`                      |
| Test command    | `npm test`                           |
| Lint command    | `npm run lint`                       |
| Dev server      | `npm run dev`                        |

### Include If Relevant

- Gotchas and warnings ("don't modify src/legacy")
- Brief architecture overview (module relationships, data flow)
- Workflow rules (branch naming, PR process, deploy steps)

### Never Include

- Things linters/formatters already enforce
- Generic programming advice Claude knows
- Verbose explanations when terse ones suffice
- Duplicate instructions
- Full style guides (link instead, or extract key rules only)

---

## Anti-Patterns

| Pattern                      | Problem                            | Fix                                 |
| ---------------------------- | ---------------------------------- | ----------------------------------- |
| "Format code properly"       | Vague, Claude knows this           | Delete or specify formatter command |
| Listing every file/directory | Bloats context, changes frequently | Describe structure conceptually     |
| Copy-pasted style guides     | Too many instructions              | Link to docs or extract key rules   |
| Edge case instructions       | Rarely triggered, always loaded    | Move to skills or nested files      |
| Overusing "Always", "Never"  | Often unnecessary emphasis         | Remove unless truly critical        |
| Auto-generated content       | Often verbose, generic             | Hand-craft for best results         |

---

## Quality Metrics

### Instruction Count

- **Good:** < 30 instructions
- **Acceptable:** 30-50 instructions
- **Warning:** 50-80 instructions
- **Critical:** > 80 instructions

### Token Efficiency

Assess information density:

- **High value:** essential commands, critical warnings, unique gotchas
- **Low value:** verbose explanations, obvious conventions, generic advice

### Completeness Checklist

- [ ] Can Claude build without asking?
- [ ] Can Claude test without asking?
- [ ] Can Claude lint without asking?
- [ ] Is project purpose clear?
- [ ] Are critical gotchas documented?

### Accuracy Checklist

- [ ] Do all commands exist?
- [ ] Do all referenced directories exist?
- [ ] Do conventions match current code?
- [ ] Are tool versions current?

---

## Output Templates

### For New CLAUDE.md Files

```markdown
# Project Name

Brief description (one line).

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run tests
- `npm run lint` — lint and fix

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

### For Review Reports

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

For monorepos, use nested CLAUDE.md files:

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

Claude loads child CLAUDE.md files on demand when working in those directories.

Root file should contain:

- Repo-wide commands (workspace scripts)
- Shared conventions
- Pointers to app-specific files

Child files should contain:

- App-specific commands
- Local gotchas
- Directory-specific conventions
