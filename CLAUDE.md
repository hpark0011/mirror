# Feel Good Monorepo

Turborepo monorepo containing multiple applications and shared packages.

## Quick Start

```bash
pnpm install           # Install all dependencies
pnpm dev               # Run all apps in dev mode
pnpm build             # Build all packages
pnpm lint              # Lint all packages
pnpm test              # Test all packages
```

## Filtered Commands

```bash
pnpm dev --filter=@feel-good/greyboard    # Run single app
pnpm build --filter=@feel-good/greyboard  # Build single app
pnpm lint --filter=@feel-good/greyboard   # Lint single app
```

## Structure

```
feel-good/
├── apps/
│   └── greyboard/              # Task management app (Next.js 15)
├── packages/
│   └── utils/                  # Shared utilities (@feel-good/utils)
├── tooling/
│   ├── eslint/                 # @feel-good/eslint-config
│   ├── prettier/               # @feel-good/prettier-config
│   └── typescript/             # @feel-good/typescript-config
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
└── package.json                # Root workspace package.json
```

## Apps

### Greyboard (`apps/greyboard`)

AI-powered document creation & task management application.
See `apps/greyboard/CLAUDE.md` for detailed documentation.

## Packages

### @feel-good/utils

Shared utility functions.

```typescript
import { cn } from "@feel-good/utils/cn";
```

### @feel-good/typescript-config

Shared TypeScript configurations.

```json
{
  "extends": "@feel-good/typescript-config/nextjs.json"
}
```

### @feel-good/eslint-config

Shared ESLint configurations.

### @feel-good/prettier-config

Shared Prettier configuration.

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
