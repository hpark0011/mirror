---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture, convex]
dependencies: []
---

# Missing ConvexProvider in Root Layout

## Problem Statement

The Mirror app's root layout does not include the `ConvexProvider` wrapper, which is required for Convex real-time subscriptions to work. The `getCurrentUser` query exported from `packages/convex/convex/auth.ts` will not function without it.

## Findings

**File:** `apps/mirror/app/layout.tsx`

**Current Implementation:**
```typescript
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={...}>
        {children}  // No ConvexProvider wrapper
      </body>
    </html>
  );
}
```

**Missing:**
- `ConvexProvider` from `convex/react`
- `ConvexReactClient` initialization

## Proposed Solutions

### Option A: Add ConvexProvider to Layout (Recommended)

**Pros:** Required for Convex to work
**Cons:** None
**Effort:** Small
**Risk:** Low

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      {children}
    </ConvexProvider>
  );
}
```

## Recommended Action

Create a Providers component and wrap the app.

## Technical Details

**Affected Files:**
- `apps/mirror/app/layout.tsx`
- Create `apps/mirror/app/providers.tsx`

## Acceptance Criteria

- [ ] Create ConvexReactClient instance
- [ ] Create Providers component
- [ ] Wrap app in ConvexProvider
- [ ] Verify Convex queries work

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-28 | Created from code review | Identified P2 architecture issue |

## Resources

- Convex React Setup: https://docs.convex.dev/client/react
