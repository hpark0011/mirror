---
status: done
priority: p3
issue_id: "013"
tags: [code-review, dry, components]
dependencies: []
---

# Duplicated Form UI Components

## Problem Statement

Error display and success message UI patterns are duplicated across all auth form components. The same markup appears in 5+ files.

## Findings

**Duplicated Error Display (all forms):**
```tsx
{error && (
  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
    {error}
  </div>
)}
```

**Duplicated Success Message (4 forms):**
```tsx
<div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
  <h3 className="font-medium text-green-800 dark:text-green-200">
    {title}
  </h3>
  <p className="mt-1 text-sm text-green-700 dark:text-green-300">
    {message}
  </p>
</div>
```

## Proposed Solutions

### Option A: Extract Shared Components (Recommended)

**Pros:** DRY, consistent styling, easy to update
**Cons:** Minor abstraction
**Effort:** Small
**Risk:** Low

```typescript
// components/form-error.tsx
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

// components/form-success.tsx
export function FormSuccess({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
      <h3 className="font-medium text-green-800 dark:text-green-200">{title}</h3>
      <p className="mt-1 text-sm text-green-700 dark:text-green-300">{message}</p>
    </div>
  );
}
```

## Recommended Action

Extract shared FormError and FormSuccess components.

## Technical Details

**Affected Files:**
- All form components in `packages/features/auth/components/`
- Create new `form-error.tsx` and `form-success.tsx`

## Acceptance Criteria

- [x] Create FormError component
- [x] Create FormSuccess component
- [x] Update all forms to use shared components
- [x] Export from components/index.ts

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P3 DRY opportunity |
| 2026-01-28 | Extracted FormError and FormSuccess components | Updated 5 forms to use shared components |

## Resources

- Files in `packages/features/auth/components/`
