---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Monorepo Conventions

## Package Imports

- Import workspace packages via `@feel-good/*` aliases
- Never use relative paths across package boundaries
- Workspace packages: `@feel-good/utils`, `@feel-good/icons`

```typescript
// ✅ Correct
import { cn } from "@feel-good/utils/cn";
import { CheckIcon } from "@feel-good/icons";

// ❌ Wrong - relative import across packages
import { cn } from "../../../packages/utils/cn";
```

## Commands

- Use `pnpm --filter=@feel-good/[app]` for single app operations
- Run `pnpm install` from root after adding dependencies
- Build affected packages after changes to shared packages

```bash
pnpm dev --filter=@feel-good/greyboard    # Run single app
pnpm build --filter=@feel-good/greyboard  # Build single app
pnpm lint --filter=@feel-good/greyboard   # Lint single app
```

## Adding New Packages

1. Create directory in `packages/`
2. Add `package.json` with name `@feel-good/package-name`
3. Add to consuming apps' dependencies: `"@feel-good/package-name": "workspace:*"`
4. Run `pnpm install` from root

## Package Configuration

Extend shared configs:

```json
// tsconfig.json
{ "extends": "@feel-good/tsconfig/nextjs.json" }

// eslint.config.mjs
import baseConfig from "@feel-good/eslint-config/next.js";
export default [...baseConfig];

// prettier.config.js
import config from "@feel-good/prettier-config";
export default config;
```

## Turborepo

- Build tasks are cached by Turborepo
- Shared packages are automatically built first due to dependency graph
- Use `turbo.json` to configure task pipelines
