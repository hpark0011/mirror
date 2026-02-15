---
status: completed
priority: p3
issue_id: "196"
tags: [code-review, pr-124, documentation, dependencies]
dependencies: []
---

# @tailwindcss/typography peer requirement undocumented

## Problem Statement

The `tiptap-content.css` styles depend on `@tailwindcss/typography` prose classes being available, but this dependency isn't declared in `@feel-good/features` package.json. Any app consuming the editor feature must independently know to install the typography plugin.

## Findings

- `packages/features/editor/styles/tiptap-content.css` — uses `--tw-prose-*` variables and assumes prose classes
- `packages/features/package.json` — no mention of `@tailwindcss/typography`
- `apps/mirror/styles/globals.css:10` — `@plugin "@tailwindcss/typography"` (consumer must add this)

## Proposed Solutions

Add `@tailwindcss/typography` as a peerDependency in `packages/features/package.json` and document the requirement in CLAUDE.md.

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] peerDependency declared or documented in editor feature docs
- [ ] Consumer apps warned if typography plugin is missing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #124 code review | CSS dependencies need same documentation as JS dependencies |
