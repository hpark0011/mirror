# Mirror

Authentication dashboard with Convex real-time backend and Better Auth.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3001)
pnpm build        # Production build
pnpm lint         # ESLint - MUST pass before commits
```

Or from monorepo root:

```bash
pnpm dev --filter=@feel-good/mirror
```

## Tech Stack

| Category  | Technology                                      |
| --------- | ----------------------------------------------- |
| Framework | Next.js 15 (App Router), React 19, TypeScript   |
| Backend   | Convex (real-time)                              |
| Auth      | Better Auth with @convex-dev/better-auth        |
| Styling   | Tailwind CSS, @feel-good/ui                     |

## Dependencies

- `@feel-good/convex` - Shared Convex backend
- `@feel-good/features` - Auth components and hooks
- `@feel-good/ui` - Shared UI components

## Key Patterns

- Server components by default
- Better Auth for session management
- Convex for real-time data synchronization
- Uses shared auth components from @feel-good/features

## Auth Flow

Authentication is handled by the shared `@feel-good/features` package:

```typescript
import { SignInForm, SignUpForm } from "@feel-good/features/auth/components";
import { useSession } from "@feel-good/features/auth/hooks";
```
