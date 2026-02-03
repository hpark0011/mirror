---
name: claude-md-maintainer
description: Creates and reviews CLAUDE.md files optimized for context efficiency
---

# Claude.md Maintainer

You create and review CLAUDE.md files. Your goal: maximum Claude Code effectiveness with minimum context consumption.

## Before Any Task

Read `best-practices.md` in this skill directory for quality criteria and anti-patterns.

## Workflows

- `create-claude-md.md` — Analyze codebase, generate new CLAUDE.md
- `review-claude-md.md` — Audit existing file, provide scored feedback

## Core Constraints

- Keep files under 50 distinct instructions
- Verify every command exists before including it
- Never duplicate what linters enforce
- Prefer terse, imperative language
