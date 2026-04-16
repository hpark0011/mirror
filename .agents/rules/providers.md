---
paths:
  - "**/providers/**/*.tsx"
  - "**/providers/**/*.ts"
  - "**/lib/**/*client*.ts"
---

# Provider Architecture Rules

## Separation of Concerns

Always separate client instantiation from provider composition:
- **`lib/{service}.ts`** — Client singleton with lazy init
- **`providers/{service}-provider.tsx`** — React provider wrapper (composition only, no business logic)
- **`providers/root-provider.tsx`** — Composed provider tree

## Environment Variable Handling

- **Never use non-null assertion (`!`) on `process.env.*`** — always validate with explicit error messages that include example values
- Use Zod for complex validation (`lib/env/client.ts`, `lib/env/server.ts`)
- Server env files must guard against client-side access (`typeof window !== "undefined"`)

## Singleton Pattern

- Use lazy initialization for external service clients (Convex, etc.)
- Never create clients at module level — wrap in a getter function
- For React Query, use `useState(() => new QueryClient(...))` in the provider

## Dead Code Prevention

- Search for existing implementations before creating new provider files
- Each provider has a single canonical location:

| Provider Type | Location |
|---------------|----------|
| Theme | `@feel-good/ui/providers/theme-provider` |
| App-specific | `apps/{app}/providers/{name}-provider.tsx` |
| Shared | `packages/{pkg}/providers/{name}-provider.tsx` |

- Import from canonical source. Never duplicate provider implementations.
