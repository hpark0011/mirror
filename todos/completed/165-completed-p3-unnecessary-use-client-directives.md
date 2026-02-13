---
status: completed
priority: p3
issue_id: "165"
tags: [code-review, react, mirror]
dependencies: []
---

# Unnecessary "use client" Directives on Pure Presentation Components

## Problem Statement

`category-filter-badges.tsx` and `category-filter-list.tsx` have `"use client"` but use only props, JSX, and callback invocations — no hooks or browser APIs. Their parent (`CategoryFilterContent`) is already a client component, making these directives redundant.

## Findings

- **Location:** `apps/mirror/features/articles/components/filter/category-filter-badges.tsx:1`, `apps/mirror/features/articles/components/filter/category-filter-list.tsx:1`

## Proposed Solutions

Remove `"use client"` from both files.

- **Effort:** Trivial

## Acceptance Criteria

- [ ] No unnecessary "use client" directives on pure presentation components

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
