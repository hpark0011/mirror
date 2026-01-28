# feat: Consolidate ESLint Configs into Shared Tooling Package

## Overview

Consolidate the separate ESLint configurations from `apps/greyboard/eslint.config.mjs` and `apps/mirror/eslint.config.mjs` into the shared `@feel-good/eslint-config` package at `tooling/eslint/`. The mirror app's modern flat config approach should be the reference implementation.

## Problem Statement

Currently, each app has its own ESLint configuration:

- **greyboard** (`apps/greyboard/eslint.config.mjs`): Uses legacy `FlatCompat` pattern with `@eslint/eslintrc`
- **mirror** (`apps/mirror/eslint.config.mjs`): Uses modern flat config with `defineConfig` and `globalIgnores`
- **tooling/eslint**: Has `next.js` and `base.js` configs but uses `@next/eslint-plugin-next` plugin approach instead of `eslint-config-next`

The tooling package's `next.js` config doesn't match the modern pattern used in mirror.

## Analysis

### Current State Comparison

| Aspect | greyboard | mirror | tooling/eslint/next.js |
|--------|-----------|--------|------------------------|
| Config style | FlatCompat (legacy) | defineConfig (modern) | tseslint.config |
| Next.js rules | `eslint-config-next` via compat | `eslint-config-next` direct spreads | `@next/eslint-plugin-next` manual |
| Global ignores | None | `globalIgnores()` helper | None |
| Core Web Vitals | Via compat extends | `nextVitals` spread | Manual rules spread |

### Mirror's Approach (Reference)

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

This is the modern, cleaner approach that:
1. Uses `defineConfig` from ESLint v9
2. Spreads the official Next.js configs directly
3. Uses `globalIgnores()` helper for clean ignore patterns

### Tooling Package Gap

The current `tooling/eslint/next.js` manually configures `@next/eslint-plugin-next` instead of using `eslint-config-next` directly. This:
- Requires more manual maintenance
- May miss updates from `eslint-config-next`
- Differs from the pattern Next.js recommends

## Proposed Solution

Update `tooling/eslint/next.js` to match mirror's modern approach, then have both apps consume the shared config.

## Acceptance Criteria

- [ ] `tooling/eslint/next.js` uses `defineConfig` from `eslint/config`
- [ ] `tooling/eslint/next.js` uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- [ ] `tooling/eslint/next.js` includes `globalIgnores` for standard Next.js outputs
- [ ] `tooling/eslint/package.json` has correct dependencies
- [ ] `apps/greyboard/eslint.config.mjs` imports and uses `@feel-good/eslint-config/next`
- [ ] `apps/mirror/eslint.config.mjs` imports and uses `@feel-good/eslint-config/next`
- [ ] `apps/mirror/package.json` includes `@feel-good/eslint-config` as devDependency
- [ ] `pnpm lint` passes for both apps

## Implementation Plan

### Phase 1: Update Shared Config

#### 1.1 Update `tooling/eslint/package.json`

Add `eslint-config-next` as a peer/dev dependency and ensure `eslint` is available:

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
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "eslint-config-prettier": "^9.0.0",
    "typescript-eslint": "^8.0.0"
  },
  "peerDependencies": {
    "eslint": "^9.0.0"
  }
}
```

**Note:** Remove `@next/eslint-plugin-next` (no longer needed when using `eslint-config-next`).

#### 1.2 Rewrite `tooling/eslint/next.js`

Match mirror's modern approach:

```javascript
// tooling/eslint/next.js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
```

### Phase 2: Update Apps

#### 2.1 Simplify `apps/greyboard/eslint.config.mjs`

```javascript
// apps/greyboard/eslint.config.mjs
export { default } from "@feel-good/eslint-config/next";
```

#### 2.2 Simplify `apps/mirror/eslint.config.mjs`

```javascript
// apps/mirror/eslint.config.mjs
export { default } from "@feel-good/eslint-config/next";
```

#### 2.3 Update `apps/mirror/package.json`

Add the shared config dependency:

```json
{
  "devDependencies": {
    "@feel-good/eslint-config": "workspace:*",
    // ... rest unchanged
  }
}
```

### Phase 3: Cleanup

#### 3.1 Remove unused dependencies from greyboard

Remove from `apps/greyboard/package.json`:
- `@eslint/eslintrc` (no longer needed with modern config)

#### 3.2 Run pnpm install

```bash
pnpm install
```

#### 3.3 Verify linting works

```bash
pnpm lint --filter=@feel-good/greyboard
pnpm lint --filter=mirror
```

## File Changes Summary

| File | Action |
|------|--------|
| `tooling/eslint/package.json` | Update dependencies |
| `tooling/eslint/next.js` | Rewrite to match mirror's approach |
| `apps/greyboard/eslint.config.mjs` | Simplify to re-export |
| `apps/greyboard/package.json` | Remove `@eslint/eslintrc` |
| `apps/mirror/eslint.config.mjs` | Simplify to re-export |
| `apps/mirror/package.json` | Add `@feel-good/eslint-config` |

## References

### Internal References
- `apps/mirror/eslint.config.mjs:1-18` - Reference implementation
- `apps/greyboard/eslint.config.mjs:1-16` - Legacy pattern to replace
- `tooling/eslint/next.js:1-23` - Current shared config to update
- `tooling/eslint/package.json:1-17` - Dependencies to update

### External References
- [ESLint Flat Config docs](https://eslint.org/docs/latest/use/configure/configuration-files) - Modern `defineConfig` and `globalIgnores`
- [Next.js ESLint](https://nextjs.org/docs/app/api-reference/config/eslint) - Official Next.js ESLint integration
