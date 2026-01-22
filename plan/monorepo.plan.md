# Plan: Convert Feel Good to Turborepo Monorepo

## Overview

Convert the existing single Next.js application (Greyboard) into a Turborepo monorepo to support multiple services (Greyboard + Mirror) with shared code, unified tooling, and optimized builds.

## Target Structure

```
feel-good/
├── apps/
│   ├── greyboard/              # Existing app (moved)
│   ├── mirror/                 # Future interactive blog service
│   └── e2e/                    # End-to-end tests (Playwright)
├── packages/
│   ├── ui/                     # Shared shadcn/ui components
│   ├── utils/                  # Shared utilities (cn, etc.)
│   ├── types/                  # Shared TypeScript types
│   └── supabase/               # Shared Supabase client & types
├── tooling/
│   ├── eslint/                 # @feel-good/eslint-config
│   ├── prettier/               # @feel-good/prettier-config
│   ├── typescript/             # @feel-good/typescript-config
│   └── scripts/                # Build/dev scripts
├── docs/                       # Documentation
├── turbo.json                  # Turborepo configuration
├── package.json                # Root workspace package.json
├── pnpm-workspace.yaml         # pnpm workspace definition
└── CLAUDE.md                   # Updated for monorepo
```

## Implementation Phases

### Phase 1: Root Workspace Setup

**Files to create:**

1. **`/package.json`** (root)
```json
{
  "name": "feel-good",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "clean": "turbo run clean",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\""
  },
  "devDependencies": {
    "prettier": "^3.2.0",
    "turbo": "^2.3.0"
  },
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20"
  }
}
```

2. **`/pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

3. **`/turbo.json`**
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "clean": {
      "cache": false
    }
  },
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV", "VERCEL_ENV"]
}
```

4. **`/.gitignore`** (update)
```
# Turborepo
.turbo

# Dependencies
node_modules

# Build outputs
.next
dist
out

# Environment
.env*.local

# IDE
.idea
.vscode

# OS
.DS_Store
```

### Phase 2: Move Greyboard to apps/

**Steps:**
1. Create `apps/` directory
2. Move entire `greyboard/` folder to `apps/greyboard/`
3. Update `apps/greyboard/package.json`:
   - Change name to `@feel-good/greyboard`
   - Add `check-types` and `clean` scripts
   - Update dependency references

**Updated `apps/greyboard/package.json`:**
```json
{
  "name": "@feel-good/greyboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "check-types": "tsc --noEmit",
    "clean": "rm -rf .next .turbo node_modules"
  }
}
```

4. Update path aliases in `apps/greyboard/tsconfig.json` (verify `@/*` still works)
5. Update `apps/greyboard/components.json` paths for shadcn

### Phase 3: Create Tooling Packages

**3.1 TypeScript Config (`tooling/typescript/`)**

`tooling/typescript/package.json`:
```json
{
  "name": "@feel-good/typescript-config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./base.json": "./base.json",
    "./nextjs.json": "./nextjs.json",
    "./react-library.json": "./react-library.json"
  }
}
```

`tooling/typescript/base.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules"]
}
```

`tooling/typescript/nextjs.json`:
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }]
  }
}
```

**3.2 ESLint Config (`tooling/eslint/`)**

`tooling/eslint/package.json`:
```json
{
  "name": "@feel-good/eslint-config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./next": "./next.js",
    "./base": "./base.js"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@next/eslint-plugin-next": "^15.0.0",
    "eslint": "^9.0.0",
    "eslint-config-prettier": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

**3.3 Prettier Config (`tooling/prettier/`)**

`tooling/prettier/package.json`:
```json
{
  "name": "@feel-good/prettier-config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js"
  }
}
```

`tooling/prettier/index.js`:
```javascript
export default {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 100
};
```

### Phase 4: Create Shared Packages

**4.1 UI Package (`packages/ui/`)** - Extract all 51 shadcn/ui components

Move all components from `greyboard/components/ui/` to `packages/ui/src/`.

`packages/ui/package.json`:
```json
{
  "name": "@feel-good/ui",
  "version": "0.0.0",
  "private": true,
  "sideEffects": ["*.css"],
  "exports": {
    "./button": "./src/button.tsx",
    "./card": "./src/card.tsx",
    "./dialog": "./src/dialog.tsx",
    "./input": "./src/input.tsx",
    "./label": "./src/label.tsx",
    "./select": "./src/select.tsx",
    "./dropdown-menu": "./src/dropdown-menu.tsx",
    "./tooltip": "./src/tooltip.tsx",
    "./avatar": "./src/avatar.tsx",
    "./badge": "./src/badge.tsx",
    "./checkbox": "./src/checkbox.tsx",
    "./popover": "./src/popover.tsx",
    "./sheet": "./src/sheet.tsx",
    "./tabs": "./src/tabs.tsx",
    "./textarea": "./src/textarea.tsx",
    "./toast": "./src/toast.tsx",
    "./sonner": "./src/sonner.tsx",
    "./*": "./src/*.tsx"
  },
  "devDependencies": {
    "@feel-good/typescript-config": "workspace:*",
    "typescript": "^5.3.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-checkbox": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.540.0",
    "sonner": "^2.0.0"
  }
}
```

**Structure:**
```
packages/ui/
├── src/
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── ... (all 51 components)
│   └── index.ts           # Re-exports all components
├── package.json
└── tsconfig.json
```

**Migration steps for UI package:**
1. Create `packages/ui/src/` directory
2. Copy all files from `apps/greyboard/components/ui/` to `packages/ui/src/`
3. Update imports in each component to use `@feel-good/utils/cn`
4. Update `apps/greyboard/` to import from `@feel-good/ui/*`
5. Update `apps/greyboard/components.json` to point to new location

**4.2 Utils Package (`packages/utils/`)**

`packages/utils/package.json`:
```json
{
  "name": "@feel-good/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./cn": "./src/cn.ts",
    "./date": "./src/date.ts"
  },
  "devDependencies": {
    "@feel-good/typescript-config": "workspace:*",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1"
  }
}
```

### Phase 5: Update Greyboard to Use Shared Packages

1. Add workspace dependencies to `apps/greyboard/package.json`:
```json
{
  "dependencies": {
    "@feel-good/ui": "workspace:*",
    "@feel-good/utils": "workspace:*"
  },
  "devDependencies": {
    "@feel-good/eslint-config": "workspace:*",
    "@feel-good/typescript-config": "workspace:*"
  }
}
```

2. Update `apps/greyboard/tsconfig.json`:
```json
{
  "extends": "@feel-good/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

3. Update `apps/greyboard/next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@feel-good/ui", "@feel-good/utils"],
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;
```

### Phase 6: Vercel Deployment Configuration

**Option A: Multiple Vercel Projects (Recommended)**

1. Keep existing Greyboard project
2. Update project settings:
   - Root Directory: `apps/greyboard`
   - Build Command: `cd ../.. && pnpm turbo build --filter=@feel-good/greyboard`
   - Install Command: `cd ../.. && pnpm install`

**Option B: Root-level vercel.json**

Create `/vercel.json`:
```json
{
  "buildCommand": "pnpm turbo build --filter=@feel-good/greyboard",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "apps/greyboard/.next"
}
```

### Phase 7: Update CI/CD & Documentation

1. Update `.github/workflows/` for monorepo paths
2. Update root `CLAUDE.md` with monorepo commands:
   - `pnpm dev` - Run all apps in dev mode
   - `pnpm dev --filter=@feel-good/greyboard` - Run single app
   - `pnpm build` - Build all packages
   - `pnpm lint` - Lint all packages
   - `pnpm test` - Test all packages

3. Create `docs/` folder structure for documentation

4. Create `apps/e2e/` folder for Playwright tests (optional, future)

---

## Verification Steps

### After Phase 1-2 (Basic Structure)
```bash
# Install dependencies
pnpm install

# Verify greyboard dev works
pnpm dev --filter=@feel-good/greyboard

# Verify build works
pnpm build --filter=@feel-good/greyboard
```

### After Phase 3-5 (Shared Packages)
```bash
# Verify all packages build
pnpm build

# Verify type checking
pnpm check-types

# Verify linting
pnpm lint

# Run tests
pnpm test
```

### After Phase 6 (Deployment)
1. Push to feature branch
2. Verify Vercel preview deployment works
3. Check build logs for cache hits
4. Merge to main and verify production deployment

---

## Migration Checklist

- [ ] Create root package.json, pnpm-workspace.yaml, turbo.json
- [ ] Move greyboard/ to apps/greyboard/
- [ ] Update package name to @feel-good/greyboard
- [ ] Verify `pnpm dev` works for greyboard
- [ ] Create tooling/typescript/ package
- [ ] Create tooling/eslint/ package
- [ ] Create tooling/prettier/ package
- [ ] Create packages/utils/ (extract cn function)
- [ ] Create packages/ui/ (extract all 51 shadcn components)
- [ ] Update greyboard to use shared packages
- [ ] Verify build works locally
- [ ] Update Vercel project settings
- [ ] Verify Vercel deployment works
- [ ] Update CLAUDE.md with monorepo commands
- [ ] Update GitHub workflows

---

## Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `/package.json` | Create | Root workspace config |
| `/pnpm-workspace.yaml` | Create | Workspace definition |
| `/turbo.json` | Create | Turborepo config |
| `/apps/greyboard/package.json` | Move + Update | Rename, add scripts |
| `/apps/greyboard/tsconfig.json` | Update | Extend shared config |
| `/apps/greyboard/next.config.ts` | Update | Add transpilePackages |
| `/tooling/typescript/*` | Create | Shared TS configs |
| `/tooling/eslint/*` | Create | Shared ESLint configs |
| `/tooling/prettier/*` | Create | Shared Prettier config |
| `/packages/utils/*` | Create | Shared utilities |
| `/packages/ui/*` | Create | Shared UI components |
| `/CLAUDE.md` | Update | Monorepo commands |
| `/.gitignore` | Update | Add .turbo |

---

## Decisions Made (User Confirmed)

1. **Database**: Separate Supabase projects per app (Greyboard and Mirror independent)
2. **Shared code**: Extract all 51 shadcn/ui components to `@feel-good/ui` package
3. **Deployment**: Multiple Vercel projects with explicit root directories
4. **Package naming**: `@feel-good/*` scope
5. **Package manager**: pnpm (already in use)
6. **Shared UI approach**: Just-in-Time compilation (no build step for UI package)
7. **Environment variables**: Per-app `.env` files
8. **Tooling location**: `tooling/` directory as specified
