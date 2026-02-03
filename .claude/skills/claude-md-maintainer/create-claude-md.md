---
name: create-claude-md
description: Generate a new CLAUDE.md by analyzing the codebase
---

# Create CLAUDE.md

Generate a CLAUDE.md file for this project.

## Prerequisites

Read `best-practices.md` for quality criteria and output template.

## Steps

### 1. Detect Tech Stack

Scan for configuration files:

- `package.json`, `yarn.lock`, `pnpm-lock.yaml`
- `pyproject.toml`, `setup.py`, `requirements.txt`
- `Cargo.toml`, `go.mod`, `Gemfile`, `Makefile`
- `.nvmrc`, `.python-version`, `.tool-versions`
- `docker-compose.yml`, `Dockerfile`

Read `README.md` for project description if exists.

### 2. Extract Commands

From package.json scripts, Makefile targets, or equivalent:

- Dev server
- Build
- Test (unit, integration, e2e if separate)
- Lint/format

**Verify each command exists before including.**

### 3. Map Structure

Identify 5-7 key directories max:

- Source code location
- Test location
- Config location
- Generated/vendored directories to avoid

### 4. Detect Conventions

Check configs (ESLint, Prettier, TypeScript) — don't repeat what they enforce.

Look for patterns in existing code:

- Named vs default exports
- File naming conventions
- Test file patterns

### 5. Identify Gotchas

Look for:

- Generated files/directories
- Legacy code with different patterns
- Environment setup requirements
- Workarounds in comments or docs

### 6. Generate File

Follow the template in `best-practices.md`. Constraints:

- Under 50 instructions
- Terse, imperative language
- Only what Claude can't infer from tooling

### 7. Self-Review

Before outputting:

- [ ] Any instruction could be shorter?
- [ ] Anything duplicated?
- [ ] Every command verified?
- [ ] Anything a linter handles?

Output the content, then offer to write to project root.
