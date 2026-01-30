---
paths:
  - "**/providers/**/*.tsx"
  - "**/providers/**/*.ts"
  - "**/lib/**/*client*.ts"
---

# Provider Architecture Rules

## Issue Prevention

These rules prevent the following architectural issues:
1. Client instantiation mixed with provider composition
2. Non-null assertion (!) without validation on environment variables
3. Module-level side effects (client created on import)
4. Duplicate/unused provider files

---

## 1. Code Organization Rules

### Separation of Concerns

**Always separate client instantiation from provider composition:**

```typescript
// lib/convex.ts - Client singleton with lazy init
let client: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (client) return client;
  // Validation and instantiation here
  client = new ConvexReactClient(url);
  return client;
}
```

```typescript
// providers/convex-provider.tsx - Provider composition only
"use client";

import { getConvexClient } from "@/lib/convex";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseConvexProvider client={getConvexClient()}>
      {children}
    </BaseConvexProvider>
  );
}
```

### File Structure

```
app-name/
├── lib/
│   ├── convex.ts          # Client singleton
│   └── env/
│       ├── client.ts      # Client env validation
│       └── server.ts      # Server env validation
├── providers/
│   ├── root-provider.tsx  # Composes all providers
│   ├── convex-provider.tsx
│   └── [other]-provider.tsx
```

### Naming Conventions

| File | Purpose |
|------|---------|
| `lib/{service}.ts` | Client singleton with lazy init |
| `lib/env/client.ts` | Client-side env validation |
| `lib/env/server.ts` | Server-side env validation |
| `providers/{service}-provider.tsx` | React provider wrapper |
| `providers/root-provider.tsx` | Composed provider tree |

---

## 2. Environment Variable Handling

### NEVER Use Non-null Assertion

```typescript
// ❌ FORBIDDEN - Runtime crash if missing
const url = process.env.NEXT_PUBLIC_API_URL!;
const client = new Client(url);

// ✅ REQUIRED - Explicit validation with helpful error
const url = process.env.NEXT_PUBLIC_API_URL;
if (!url) {
  throw new Error(
    "❌ Missing NEXT_PUBLIC_API_URL environment variable.\n\n" +
    "Set this in your .env.local file:\n" +
    '  NEXT_PUBLIC_API_URL="https://your-api.com"'
  );
}
```

### Use Zod for Complex Validation

```typescript
// lib/env/client.ts
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url("Must be a valid URL"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
});

function validateClientEnv() {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`❌ Missing or invalid environment variables:\n${errors}`);
  }

  return result.data;
}

export const clientEnv = validateClientEnv();
```

### Server vs Client Separation

```typescript
// lib/env/server.ts - Add runtime guard
function validateServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment variables should not be accessed on the client");
  }
  // ... validation
}
```

---

## 3. Singleton Patterns with Lazy Initialization

### When to Use Lazy Init

- External service clients (Convex, Supabase, Firebase)
- WebSocket connections
- Heavy initialization logic

### Pattern Template

```typescript
// lib/{service}.ts
import { ServiceClient } from "service-package";

let client: ServiceClient | null = null;

/**
 * Get the service client singleton.
 * Uses lazy initialization to avoid module-level side effects.
 */
export function getServiceClient(): ServiceClient {
  if (client) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SERVICE_URL;

  if (!url) {
    throw new Error(
      "❌ Missing NEXT_PUBLIC_SERVICE_URL environment variable.\n\n" +
      "Set this in your .env.local file:\n" +
      '  NEXT_PUBLIC_SERVICE_URL="https://your-service.com"'
    );
  }

  client = new ServiceClient(url);
  return client;
}
```

### React Query Pattern

For React Query, use `useState` in the provider to create the client once:

```typescript
// providers/react-query-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

---

## 4. Dead Code Prevention

### Before Creating New Provider Files

1. Search for existing implementations: `providers/**/*.tsx`
2. Check for duplicate functionality in `lib/` directory
3. Verify the provider doesn't exist under a different name

### File Ownership

Each provider should have a single source of truth:

| Provider Type | Canonical Location |
|---------------|-------------------|
| Theme | `@feel-good/ui/providers/theme-provider` |
| App-specific | `apps/{app}/providers/{name}-provider.tsx` |
| Shared | `packages/{pkg}/providers/{name}-provider.tsx` |

### Import from Canonical Source

```typescript
// ✅ Import from package for shared providers
import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";

// ✅ Import from app's providers directory
import { ConvexProvider } from "@/providers/convex-provider";

// ❌ Never duplicate provider implementations
// ❌ Never create local copies of shared providers
```

---

## Prevention Checklist

Before merging any provider-related code, verify:

### Code Organization
- [ ] Client instantiation is in `lib/` directory, not in provider file
- [ ] Provider file only handles React context composition
- [ ] No business logic in provider components
- [ ] Single responsibility per file

### Environment Variables
- [ ] No non-null assertions (`!`) on `process.env.*`
- [ ] All env vars validated with explicit error messages
- [ ] Error messages include example values
- [ ] Server-only vars have client-access guards

### Singletons
- [ ] Uses lazy initialization (not module-level)
- [ ] Returns existing instance if already created
- [ ] Validation happens inside getter function
- [ ] Clear JSDoc describing the pattern

### Dead Code
- [ ] No duplicate provider files
- [ ] Imports from canonical package location
- [ ] Removed any superseded implementations
- [ ] No orphaned files after refactoring

---

## ESLint Rules to Consider

```javascript
// Future: Custom ESLint rules
rules: {
  // Warn on non-null assertion with process.env
  "no-non-null-assertion-env": "error",

  // Require lazy init pattern for specific imports
  "require-lazy-init": ["error", {
    packages: ["convex/react", "@supabase/supabase-js"]
  }],

  // Prevent direct process.env access without validation
  "validated-env-access": "error"
}
```

### TypeScript Strict Settings

Ensure `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```
