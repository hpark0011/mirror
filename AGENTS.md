# Feel Good Monorepo

Turborepo monorepo with 3 Next.js applications and shared packages.

## Quick Start

```bash
pnpm install           # Install all dependencies
pnpm dev               # Run all apps in dev mode
pnpm build             # Build all packages
pnpm lint              # Lint all packages
pnpm format            # Format all files
```

### Filtered Commands

```bash
pnpm dev --filter=@feel-good/greyboard    # Run single app
pnpm build --filter=@feel-good/greyboard  # Build single app
pnpm lint --filter=@feel-good/greyboard   # Lint single app
```

## Monorepo Structure

```
apps/           Next.js applications (greyboard, mirror, ui-factory)
packages/       Shared libraries (ui, features, icons, utils, convex)
tooling/        Shared configs (eslint, prettier, typescript)
```

## Apps

| App        | Description                   | Port |
| ---------- | ----------------------------- | ---- |
| greyboard  | AI-powered task management    | 3000 |
| mirror     | Interactive blogging platform | 3001 |
| ui-factory | Design system showcase        | 3002 |

## Packages

| Package             | Purpose                         | Example Import                    |
| ------------------- | ------------------------------- | --------------------------------- |
| @feel-good/ui       | shadcn/ui primitives            | `@feel-good/ui/primitives/button` |
| @feel-good/features | Feature components (auth, dock) | `@feel-good/features/auth/blocks` |
| @feel-good/icons    | SVG icon components             | `@feel-good/icons`                |
| @feel-good/utils    | Utilities (cn, etc.)            | `@feel-good/utils/cn`             |
| @feel-good/convex   | Convex backend                  | `@feel-good/convex`               |

### @feel-good/utils

Shared utility functions.

```typescript
import { cn } from "@feel-good/utils/cn";
```

### @feel-good/icons

SVG icon components as React components.

```typescript
import { CheckIcon, CloseIcon } from "@feel-good/icons";
```

### @feel-good/ui

Shared UI component library based on shadcn/ui primitives.

```typescript
import { Button } from "@feel-good/ui/primitives/button";
import { Card } from "@feel-good/ui/primitives/card";
import { Dialog } from "@feel-good/ui/primitives/dialog";
```

### @feel-good/features

Shared feature components (auth, dock).

```typescript
// Auth forms
import {
  MagicLinkLoginForm,
  MagicLinkSignUpForm,
  OTPLoginForm,
  OTPSignUpForm,
} from "@feel-good/features/auth/components/forms";

// Auth hooks
import {
  useMagicLinkRequest,
  useOTPAuth,
  createUseSession,
} from "@feel-good/features/auth/hooks";

// Auth blocks (drop-in page sections)
import { LoginBlock, SignUpBlock } from "@feel-good/features/auth/blocks";

// Dock
import { AppDock } from "@feel-good/features/dock/blocks";
```

#### Auth Package Layers

| Layer  | Import                                      | Purpose                   |
| ------ | ------------------------------------------- | ------------------------- |
| Blocks | `@feel-good/features/auth/blocks`           | Drop-in page sections     |
| Forms  | `@feel-good/features/auth/components/forms` | Complete forms with logic |
| Views  | `@feel-good/features/auth/views`            | Pure UI components        |
| Hooks  | `@feel-good/features/auth/hooks`            | Headless auth logic       |

### @feel-good/convex

Shared Convex backend configuration and functions.

```typescript
import { api } from "@feel-good/convex";
```

### @feel-good/tsconfig

Shared TypeScript configurations. Choose based on package type:

| Config               | Use Case                                        |
| -------------------- | ----------------------------------------------- |
| `base.json`          | Backend/non-browser packages (e.g., Convex)     |
| `react-library.json` | React component libraries (ui, icons, features) |
| `nextjs.json`        | Next.js applications (greyboard, mirror)        |

```json
{
  "extends": "@feel-good/tsconfig/react-library.json"
}
```

Available configs in `tooling/typescript/`:

```
├── base.json             # ES2022, strict mode, bundler resolution
├── react-library.json    # Extends base + DOM libs + react-jsx
└── nextjs.json           # Extends base + Next.js plugin + jsx preserve
```

### @feel-good/eslint-config

Shared ESLint configurations.

### @feel-good/prettier-config

Shared Prettier configuration.

## Testing

When testing browser/UI behavior, use CLI-based tools (e.g., Playwright CLI) rather than browser extension MCPs or Chrome MCP unless explicitly asked. Never default to Playwright MCP plugin.

## Debugging

Before attempting any fix for a bug, follow the `/debug` protocol:

1. State your hypothesis for the root cause
2. Describe what evidence would confirm or refute it
3. Add instrumentation/logging to gather that evidence
4. Only after confirming the root cause, propose a fix

Do NOT skip to a theoretical fix.

## Core Principles

- **Simplicity First** — Make every change as simple as possible. Impact minimal code.
- **No Laziness** — Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact** — Changes should only touch what is necessary. Avoid introducing bugs.

## Git Workflow

Never commit directly to main. Always use feature branches. When a merge conflict or branch divergence occurs, stop and ask the user before force-pushing or resetting.

## Adding a New App

1. Create directory in `apps/`
2. Add `package.json` with name `@feel-good/app-name`
3. Reference workspace packages: `"@feel-good/utils": "workspace:*"`
4. Run `pnpm install` from root

## Adding a New Package

1. Create directory in `packages/`
2. Add `package.json` with name `@feel-good/package-name`
3. Add to consuming apps' dependencies
4. Run `pnpm install` from root
