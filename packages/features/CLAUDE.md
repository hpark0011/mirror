# @feel-good/features

Shared feature components across Feel Good apps.

## Installation

Add to your app's dependencies:

```json
{
  "dependencies": {
    "@feel-good/features": "workspace:*"
  }
}
```

## Auth Feature

Authentication components and utilities using Better Auth with Convex.

### Components

```typescript
import {
  SignInForm,
  SignUpForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  MagicLinkForm,
  OAuthButtons,
  SessionProvider,
  FormError,
  FormSuccess,
} from "@feel-good/features/auth/components";
```

### Hooks

```typescript
import { useSession } from "@feel-good/features/auth/hooks";
```

### Client/Server Utilities

```typescript
// Client-side auth
import { authClient } from "@feel-good/features/auth/client";

// Server-side auth
import { auth } from "@feel-good/features/auth/server";

// Types
import type { Session, User } from "@feel-good/features/auth/types";
```

## Structure

```
auth/
├── components/       # Auth UI components
│   ├── sign-in-form.tsx
│   ├── sign-up-form.tsx
│   ├── forgot-password-form.tsx
│   ├── reset-password-form.tsx
│   ├── magic-link-form.tsx
│   ├── oauth-buttons.tsx
│   ├── session-provider.tsx
│   ├── form-error.tsx
│   └── form-success.tsx
├── hooks/            # Auth hooks (useSession, etc.)
├── utils/            # Auth utilities
├── client.ts         # Client-side auth setup
├── server.ts         # Server-side auth setup
├── types.ts          # TypeScript types
└── index.ts          # Barrel export
```

## Adding New Features

1. Create feature directory in package root (e.g., `notifications/`)
2. Add barrel export in `index.ts`
3. Update `package.json` exports field
4. Run `pnpm install` from monorepo root

## Dependencies

- `@feel-good/ui` - UI components
- `better-auth` - Authentication library
- `@convex-dev/better-auth` - Convex adapter
- `convex` - Real-time backend
