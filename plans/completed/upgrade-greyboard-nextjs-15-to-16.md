# Upgrade @feel-good/greyboard from Next.js 15.4.10 to 16.1.4

**Type:** Enhancement
**Complexity:** Medium
**Estimated Risk:** Low-Medium
**Status:** ✅ Completed

## Overview

Upgrade the `@feel-good/greyboard` app from Next.js 15.4.10 to 16.1.4 to align with `@apps/mirror` which already runs Next.js 16.1.4. This ensures consistency across the monorepo and gives access to Next.js 16 features including Turbopack as the default bundler.

## Current State

| App | Next.js | React | react-dom | eslint-config-next |
|-----|---------|-------|-----------|-------------------|
| greyboard | 15.4.10 | 19.1.0 | 19.1.0 | 15.4.7 |
| mirror | 16.1.4 | 19.2.3 | 19.2.3 | 16.1.4 |

## Target State

| App | Next.js | React | react-dom | eslint-config-next |
|-----|---------|-------|-----------|-------------------|
| greyboard | 16.1.4 | 19.2.3 | 19.2.3 | 16.1.4 |
| mirror | 16.1.4 | 19.2.3 | 19.2.3 | 16.1.4 |

## Breaking Changes in Next.js 16

### 1. `next lint` Command Removed (CRITICAL)

The `next lint` command no longer exists. Must use ESLint directly.

**Current `apps/greyboard/package.json`:**
```json
{
  "scripts": {
    "lint": "next lint"
  }
}
```

**Required change:**
```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

### 2. Turbopack is Now Default

Turbopack is the default bundler for both `next dev` and `next build`. The `--turbopack` flag is no longer needed.

**Your current scripts don't use `--turbopack`, so no script changes needed.**

However, greyboard has `webpack` as a direct dependency. This might be for `@next/bundle-analyzer`. If any custom webpack config exists, builds may need the `--webpack` flag.

### 3. Middleware Renamed to Proxy (Optional)

`middleware.ts` is deprecated in favor of `proxy.ts`. However:
- The deprecation warning is non-blocking
- `proxy.ts` runs on Node.js only (no Edge runtime)
- Your current middleware works fine and can remain as-is

**Recommendation:** Keep `middleware.ts` for now. Address in a future PR if needed.

### 4. ESLint Config in next.config.ts Removed

The `eslint` option in `next.config.ts` is no longer valid.

**Current `apps/greyboard/next.config.ts`:**
```typescript
eslint: { ignoreDuringBuilds: true },
```

**This line should be removed.**

### 5. Async Request APIs (Already Compliant)

Your codebase already uses async patterns for `cookies()`, `headers()`, etc. No changes needed.

## Acceptance Criteria

- [x] `next` updated to 16.1.4
- [x] `react` and `react-dom` updated to 19.2.3
- [x] `eslint-config-next` updated to 16.1.4
- [x] Lint script changed from `"next lint"` to `"eslint ."`
- [x] `eslint` option removed from `next.config.ts`
- [x] `pnpm dev` runs successfully with Turbopack
- [x] `pnpm build` completes without errors
- [ ] `pnpm lint` passes (pre-existing issues unrelated to upgrade)
- [ ] Authentication flow (sign in/out) works correctly (manual testing required)
- [ ] Protected routes redirect properly (manual testing required)

## Implementation Plan

### Phase 1: Update Shared Tooling

**File:** `tooling/eslint/package.json`

The current peer dependency `"eslint-config-next": ">=15.0.0"` already supports Next.js 16. No changes needed, but verify compatibility.

### Phase 2: Update Dependencies

**File:** `apps/greyboard/package.json`

```diff
  "dependencies": {
-   "next": "15.4.10",
+   "next": "16.1.4",
-   "react": "19.1.0",
+   "react": "19.2.3",
-   "react-dom": "19.1.0",
+   "react-dom": "19.2.3",
  },
  "devDependencies": {
-   "eslint-config-next": "15.4.7",
+   "eslint-config-next": "16.1.4",
  }
```

### Phase 3: Update Scripts

**File:** `apps/greyboard/package.json`

```diff
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
-   "lint": "next lint",
+   "lint": "eslint .",
  }
```

### Phase 4: Update Configuration

**File:** `apps/greyboard/next.config.ts`

```diff
  const nextConfig = {
    output: process.env.ELECTRON_BUILD === "true" ? "standalone" : undefined,
    transpilePackages: ["@feel-good/icons", "@feel-good/ui", "@feel-good/utils"],
-   eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
  };
```

### Phase 5: Install and Verify

```bash
# Install updated dependencies
pnpm install

# Verify dev server works
pnpm dev --filter=@feel-good/greyboard

# Verify lint works
pnpm lint --filter=@feel-good/greyboard

# Verify build works
pnpm build --filter=@feel-good/greyboard
```

### Phase 6: Manual QA

- [ ] Navigate to http://localhost:3000
- [ ] Sign in with Supabase auth
- [ ] Verify protected routes work
- [ ] Sign out
- [ ] Verify redirect to sign-in page
- [ ] Test Kanban board drag-and-drop
- [ ] Test form submissions
- [ ] Check browser console for errors

## Files to Modify

| File | Change |
|------|--------|
| `apps/greyboard/package.json` | Update next, react, react-dom, eslint-config-next; change lint script |
| `apps/greyboard/next.config.ts` | Remove `eslint: { ignoreDuringBuilds: true }` |

## Files That Remain Unchanged

| File | Reason |
|------|--------|
| `apps/greyboard/middleware.ts` | Keep as-is (deprecated but functional, low risk) |
| `apps/greyboard/eslint.config.mjs` | Already using flat config format |
| `tooling/eslint/package.json` | Version constraint `>=15.0.0` already supports 16.x |
| `tooling/eslint/next.js` | Shared config is compatible |

## Dependencies & Library Compatibility

| Library | Current Version | React 19.2 Compatible | Notes |
|---------|----------------|----------------------|-------|
| @radix-ui/* | 1.x | Yes | SSR-optimized, works with Next.js 16 |
| @tanstack/react-query | ^5.85.5 | Yes | v5 has full React 19 support |
| framer-motion | ^12.23.12 | Yes | v12 includes React 19 support |
| @dnd-kit/core | ^6.3.1 | Yes | Legacy API stable |
| @dnd-kit/sortable | ^10.0.0 | Yes | Works with React 19 |
| recharts | 2.15.4 | Yes | Compatible |
| zustand | ^5.0.8 | Yes | Full React 19 support |
| react-hook-form | ^7.62.0 | Yes | Compatible |
| @supabase/ssr | ^0.7.0 | Yes | No Next.js 16 issues reported |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Turbopack incompatibility with webpack dep | Low | High | Use `--webpack` flag if needed |
| Third-party library React 19.2 issues | Low | Medium | Libraries already tested with React 19 |
| Middleware deprecation warnings | High | Low | Warnings are non-blocking, can address later |
| ESLint config issues | Low | Low | Shared config already uses flat format |

## Rollback Plan

If issues arise after upgrade:

```bash
# Revert package.json changes
git checkout apps/greyboard/package.json
git checkout apps/greyboard/next.config.ts

# Reinstall dependencies
pnpm install
```

## Future Considerations

1. **Middleware to Proxy Migration:** Consider migrating `middleware.ts` to `proxy.ts` in a future PR. This would require:
   - Moving auth logic to layouts/route handlers (Next.js 16 recommendation)
   - Testing with @supabase/ssr patterns
   - Verifying Vercel deployment compatibility

2. **Remove webpack Dependency:** Investigate if the explicit `webpack` dependency is needed or can be removed now that Turbopack is default.

3. **Update CLAUDE.md:** Update the tech stack section to reflect Next.js 16.1.4.

## References

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16)
- [ESLint Flat Config Migration](https://eslint.org/docs/latest/use/configure/migration-guide)
- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

---

## Commands Summary

```bash
# Run the upgrade
cd /Users/disquiet/Desktop/feel-good

# Update dependencies
pnpm up next@16.1.4 react@19.2.3 react-dom@19.2.3 --filter=@feel-good/greyboard
pnpm up eslint-config-next@16.1.4 --filter=@feel-good/greyboard

# Then manually:
# 1. Edit apps/greyboard/package.json to change lint script
# 2. Edit apps/greyboard/next.config.ts to remove eslint option

# Reinstall and verify
pnpm install
pnpm dev --filter=@feel-good/greyboard
pnpm lint --filter=@feel-good/greyboard
pnpm build --filter=@feel-good/greyboard
```
