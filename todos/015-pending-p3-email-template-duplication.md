---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, dry, email]
dependencies: []
---

# Email Template HTML Duplicated

## Problem Statement

Email HTML templates in `email.ts` are inline strings (30+ lines each) duplicated across three functions with only minor text differences.

## Findings

**File:** `packages/convex/convex/email.ts`

**Three Similar Templates:**
1. `sendMagicLink` (lines 20-36)
2. `sendVerificationEmail` (lines 51-66)
3. `sendPasswordReset` (lines 82-97)

All share identical:
- HTML structure
- CSS styling
- Meta tags
- Container layout

Only differences:
- Title text
- Body message
- Button text
- Footer text

## Proposed Solutions

### Option A: Extract Template Function (Recommended)

**Pros:** Single source of truth, easy styling updates
**Cons:** Minor abstraction
**Effort:** Small
**Risk:** Low

```typescript
interface EmailTemplateConfig {
  title: string;
  message: string;
  buttonText: string;
  link: string;
  footerText: string;
}

function createEmailTemplate(config: EmailTemplateConfig): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>...</head>
    <body style="...">
      <div style="...">
        <h1>${config.title}</h1>
        <p>${config.message}</p>
        <a href="${config.link}">${config.buttonText}</a>
        <p>${config.footerText}</p>
      </div>
    </body>
    </html>
  `;
}
```

## Recommended Action

Extract common email template to a shared function.

## Technical Details

**Affected File:** `packages/convex/convex/email.ts`

## Acceptance Criteria

- [ ] Create createEmailTemplate function
- [ ] Update all three email functions to use it
- [ ] Verify emails render correctly
- [ ] Reduce file from ~100 lines to ~50 lines

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P3 DRY opportunity |

## Resources

- File: `packages/convex/convex/email.ts`
