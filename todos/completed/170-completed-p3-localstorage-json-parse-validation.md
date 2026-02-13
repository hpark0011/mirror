---
status: completed
priority: p3
issue_id: "170"
tags: [code-review, security, correctness, mirror]
dependencies: ["155"]
---

# No localStorage JSON.parse Schema Validation

## Problem Statement

`useLocalStorage` uses `JSON.parse` output directly without validating it conforms to the expected shape. Malformed data (from browser extensions, XSS on sibling subdomains, or manual tampering) could cause runtime crashes (e.g., `filterState.categories.length` on a non-array).

## Findings

- **Location:** `apps/mirror/hooks/use-local-storage.ts:16-24`

## Proposed Solutions

Add a validation/normalization step when loading from localStorage. Either a lightweight shape check or Zod schema validation (Zod is already in devDependencies).

- **Effort:** Small

## Acceptance Criteria

- [ ] Invalid localStorage data falls back to initialValue instead of crashing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-12 | Created from PR #120 code review | |
