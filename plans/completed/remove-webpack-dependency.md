# Remove Orphaned Webpack Dependency from Greyboard

**Type:** Cleanup
**Complexity:** Low
**Risk:** Low
**Status:** Pending

## Summary

Remove the unused `webpack` dependency from `apps/greyboard/package.json`. This dependency is orphaned - it was originally added to support `@svgr/webpack` (for SVG handling), but that package was removed on Jan 26, 2026 when icons migrated to `@feel-good/icons`. Webpack was accidentally left behind.

## Evidence Supporting Removal

1. **No webpack config files** exist in the codebase
2. **No webpack imports** in any TypeScript/TSX files
3. **`next.config.ts` has zero webpack configuration** - it's a clean config
4. **`@next/bundle-analyzer` does NOT require webpack** as a peer dependency
5. **Next.js 16 uses Turbopack by default** - explicit webpack is unnecessary
6. **Git history confirms** webpack was added alongside `@svgr/webpack` (commit `530b807`), but only `@svgr/webpack` was removed (commit `54863db`)

## Implementation

### File to Modify

`apps/greyboard/package.json`

### Change

Remove line 85:

```diff
     "tailwindcss": "^4",
     "tw-animate-css": "^1.3.7",
     "vaul": "^1.1.2",
-    "webpack": "^5.101.3",
     "zod": "^4.0.17",
     "zustand": "^5.0.8"
```

### Post-Change Commands

```bash
pnpm install
```

## Validation Steps

Run these commands from the monorepo root to verify nothing breaks:

### 1. Install dependencies (must succeed)

```bash
pnpm install
```

### 2. Development server (must start without errors)

```bash
pnpm dev --filter=@feel-good/greyboard
# Verify: Server starts, visit http://localhost:3000
```

### 3. Production build (must complete successfully)

```bash
pnpm build --filter=@feel-good/greyboard
# Verify: Build completes with "Compiled successfully"
```

### 4. Lint (should match pre-removal behavior)

```bash
pnpm lint --filter=@feel-good/greyboard
# Verify: Same lint output as before (pre-existing issues unrelated)
```

### 5. Type check (must pass)

```bash
pnpm check-types --filter=@feel-good/greyboard
# Verify: No type errors
```

## Note on Bundle Analyzer

The `@next/bundle-analyzer` package remains installed but is **not currently configured** in `next.config.ts`. The `analyze` script (`ANALYZE=true next build`) doesn't work regardless of webpack presence. This is a separate issue that could be addressed in a future PR if bundle analysis is needed.

## References

- Related PR: #62 (Next.js 16 upgrade)
- Upgrade plan: `plans/upgrade-greyboard-nextjs-15-to-16.md`
