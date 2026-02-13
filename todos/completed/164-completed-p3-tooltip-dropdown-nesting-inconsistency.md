---
status: completed
priority: p3
issue_id: "164"
tags: [code-review, consistency, mirror]
dependencies: []
---

# Tooltip/DropdownMenu Nesting Order Inconsistent Between Sort and Filter

## Problem Statement

Sort dropdown nests `DropdownMenu > Tooltip > TooltipTrigger > DropdownMenuTrigger`. Filter dropdown nests `Tooltip > DropdownMenu > TooltipTrigger > DropdownMenuTrigger`. The filter dropdown also conditionally clears tooltip content when open; the sort dropdown does not, allowing the "Sort" tooltip to flash while the dropdown is open.

## Findings

- **Location:** `article-sort-dropdown.tsx:37-51` vs `article-filter-dropdown.tsx:67-82`

## Proposed Solutions

Standardize on the filter dropdown's pattern (Tooltip wrapping DropdownMenu with conditional content).

- **Effort:** Small

## Acceptance Criteria

- [ ] All toolbar dropdowns use the same Tooltip/DropdownMenu nesting order
- [ ] No tooltip flash when dropdown is open

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
