# Feel Good Monorepo

Turborepo monorepo containing multiple applications and shared packages.

## Quick Start

```bash
pnpm install           # Install all dependencies
pnpm dev               # Run all apps in dev mode
pnpm build             # Build all packages
pnpm lint              # Lint all packages
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
│   ├── icons/                  # SVG icon components (@feel-good/icons)
│   └── utils/                  # Shared utilities (@feel-good/utils)
├── tooling/
│   ├── eslint/                 # @feel-good/eslint-config
│   ├── prettier/               # @feel-good/prettier-config
│   └── typescript/             # @feel-good/tsconfig
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

### @feel-good/icons

SVG icon components as React components.

```typescript
import { CheckIcon, CloseIcon } from "@feel-good/icons";
```

### @feel-good/tsconfig

Shared TypeScript configurations.

```json
{
  "extends": "@feel-good/tsconfig/nextjs.json"
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

## Claude Code Configuration

```
.claude/
├── rules/                    # Path-specific rules (auto-loaded by context)
│   ├── monorepo.md          # Workspace conventions
│   ├── typescript.md        # TypeScript rules
│   ├── react-components.md  # Component patterns
│   ├── forms.md             # Form handling
│   ├── state-management.md  # State patterns
│   └── apps/greyboard/      # App-specific rules
├── skills/                   # Detailed documentation
├── commands/                 # Custom commands
└── agents/                   # AI agents
```

### Personal Preferences

Copy `CLAUDE.local.md.example` to `CLAUDE.local.md` for personal preferences (gitignored).
