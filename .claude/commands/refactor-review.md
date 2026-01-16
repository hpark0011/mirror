---
name: refactor-review
description: Analyze codebase for refactoring opportunities. Checks component sizes, hook extraction candidates, and separation of concerns violations.
---

# Refactor Review

Analyze the codebase for refactoring opportunities based on project conventions in CLAUDE.md.

## Analysis Targets

Review these locations in order:

1. `features/**/components/*.tsx` - Feature components
2. `components/**/*.tsx` - Shared components
3. `app/**/_components/*.tsx` - Route components
4. `app/**/page.tsx` - Page components

## Checks

### 1. Component Size (>100 lines)

Flag components exceeding the 100-line guideline.

**Action**: For each file, count lines and report:
```
[OVER_LIMIT] features/kanban-board/components/board.tsx (142 lines)
  - Consider extracting: [specific logic to extract]
```

### 2. Hook Extraction Candidates

Flag components with 3+ `useMemo`/`useCallback` for business logic.

**Signs of extraction needed**:
- Multiple related state variables
- Complex derived state calculations
- Side effects that could be grouped
- Reusable logic patterns

**Action**: Report:
```
[EXTRACT_HOOK] features/ticket-form/components/ticket-form-dialog.tsx
  - 4 useMemo calls for form validation logic
  - Suggested hook: useTicketFormValidation
```

### 3. Separation of Concerns

Check for violations of the layer separation:

| Layer | Should NOT contain |
|-------|-------------------|
| UI (`components/`) | Business logic, data fetching, complex state |
| Hooks (`hooks/`) | JSX, direct DOM manipulation |
| Logic (`lib/`, `utils/`) | React imports, hooks, state |

**Action**: Report:
```
[CONCERN_VIOLATION] components/ui/data-table.tsx
  - Contains fetch logic (should be in hook)
  - Line 45-67: API call should move to useDataTableQuery
```

### 4. Missing Feature Module

Identify components that should be extracted to `/features/`:

**Criteria for feature extraction**:
- 3+ related components in same directory
- Has dedicated hooks or utilities
- Self-contained functionality
- Used across multiple routes

**Action**: Report:
```
[FEATURE_CANDIDATE] components/notifications/
  - 4 related components found
  - Has notification.utils.ts
  - Suggested: features/notifications/
```

### 5. Duplicate Patterns

Identify repeated code patterns across files.

**Common duplicates**:
- Similar form handling logic
- Repeated localStorage patterns
- Duplicate utility functions
- Copy-pasted component structures

## Process

1. **Scan files** - Read all target files
2. **Run checks** - Apply each check above
3. **Prioritize** - Sort by impact (size violations first)
4. **Report** - Generate structured output
5. **Suggest** - Provide actionable refactoring steps

## Output Format

```markdown
# Refactor Review Report

**Scanned**: {count} files
**Issues Found**: {count}

---

## Critical (Fix Now)

{Components over 150 lines or major violations}

### {filename} ({line_count} lines)

**Issues**:
- [OVER_LIMIT] Exceeds 100-line guideline by {n} lines
- [EXTRACT_HOOK] {description}

**Suggested Refactoring**:
1. Extract lines {x}-{y} into `use{HookName}`
2. Move {logic} to `{feature}/utils/`
3. Split into `{ComponentA}` and `{ComponentB}`

---

## Warnings (Address Soon)

{Components 100-150 lines or minor violations}

---

## Opportunities (When Free)

{Potential improvements, not urgent}

---

## Summary

- **Critical**: {count} files need immediate attention
- **Warnings**: {count} files should be reviewed
- **Opportunities**: {count} optional improvements

### Quick Wins (< 15 min each)
1. {specific actionable item}
2. {specific actionable item}

### Larger Refactors
1. {description} - affects {n} files
```

## Guidelines

- **Don't over-engineer** - Only suggest extractions that genuinely improve clarity
- **Match existing patterns** - Suggest structures consistent with `/features/` modules
- **Be specific** - Include line numbers and exact suggestions
- **Prioritize by impact** - Size violations matter more than style preferences
- **Consider dependencies** - Note when refactoring affects other files
