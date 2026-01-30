---
title: "Refactor provider architecture for better separation of concerns"
date: 2026-01-29
category: architecture-patterns
tags:
  - convex
  - providers
  - singleton-pattern
  - lazy-initialization
  - environment-validation
  - separation-of-concerns
  - next.js
module: mirror/providers
symptoms:
  - Client instantiation mixed with provider composition
  - Non-null assertion (!) on environment variables without validation
  - Module-level side effect creating client on import
  - Unused duplicate providers file
severity: medium
---

# Provider Architecture: Separation of Concerns

## Problem

The original `root-provider.tsx` had several architectural issues:

```typescript
// BEFORE: Multiple concerns mixed together
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function RootProvider({ children }) {
  return (
    <ThemeProvider>
      <ConvexProvider client={convex}>
        <SessionProvider>{children}</SessionProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
```

**Issues identified:**

1. **Module-level side effect** - Client created on import, not when needed
2. **Non-null assertion** - `!` suppresses TypeScript without runtime validation
3. **Mixed responsibilities** - Client creation + provider composition in one file
4. **Duplicate file** - `components/providers.tsx` was identical but unused

## Root Cause

The root cause was **conflation of concerns**:

- Client instantiation (infrastructure concern)
- Environment validation (configuration concern)
- Provider composition (React tree concern)

All three were handled in a single file, making the code harder to test, maintain, and debug.

## Solution

### 1. Create Client Factory (`lib/convex.ts`)

Singleton pattern with lazy initialization and proper validation:

```typescript
import { ConvexReactClient } from "@feel-good/convex";

let convexClient: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (convexClient) {
    return convexClient;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_CONVEX_URL environment variable.\n\n" +
        "Set this in your .env.local file:\n" +
        '  NEXT_PUBLIC_CONVEX_URL="https://your-deployment.convex.cloud"'
    );
  }

  convexClient = new ConvexReactClient(convexUrl);
  return convexClient;
}
```

### 2. Create Thin Provider Wrapper (`providers/convex-provider.tsx`)

Single responsibility - wrap children with Convex context:

```typescript
"use client";

import { ConvexProvider as BaseConvexProvider } from "@feel-good/convex";
import { getConvexClient } from "@/lib/convex";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseConvexProvider client={getConvexClient()}>
      {children}
    </BaseConvexProvider>
  );
}
```

### 3. Simplify Root Provider (`providers/root-provider.tsx`)

Pure composition only:

```typescript
"use client";

import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";
import { SessionProvider } from "@/lib/auth-client";
import { ConvexProvider } from "./convex-provider";

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ConvexProvider>
        <SessionProvider>{children}</SessionProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
```

### 4. Delete Unused Duplicate

Removed `components/providers.tsx` which was identical but not imported anywhere.

## Architecture Diagram

```
providers/root-provider.tsx (composition only)
    |
    +-- ThemeProvider (from @feel-good/ui)
    |
    +-- providers/convex-provider.tsx (thin wrapper)
    |       |
    |       +-- lib/convex.ts (singleton factory)
    |               |
    |               +-- ConvexReactClient instance
    |
    +-- SessionProvider (from @/lib/auth-client)
```

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Testability | Hard to mock (module-level) | Easy to mock (factory function) |
| Error Handling | Silent crash | Developer-friendly error with fix |
| SSR Safety | Client on import | Client only when needed |
| Separation | Mixed responsibilities | Single responsibility per module |
| Maintainability | Changes affect all concerns | Changes isolated |

## Prevention

### Code Organization Rules

- Client instantiation belongs in `lib/` directory
- Provider files only handle React context composition
- No business logic in provider components

### Environment Variable Handling

- Never use non-null assertion (`!`) on `process.env`
- Always validate with explicit error messages
- Include example values in error messages

### Singleton Pattern

- Use lazy initialization (not module-level)
- Check for existing instance before creating
- Validation happens inside getter function

## Related

- Session provider uses similar factory pattern in `packages/features/auth`
- Greyboard uses similar composition in `apps/greyboard/providers`
- Environment validation pattern in `lib/env/client.ts`

## Files Changed

| File | Action |
|------|--------|
| `apps/mirror/lib/convex.ts` | Created |
| `apps/mirror/providers/convex-provider.tsx` | Created |
| `apps/mirror/providers/root-provider.tsx` | Modified |
| `apps/mirror/components/providers.tsx` | Deleted |
