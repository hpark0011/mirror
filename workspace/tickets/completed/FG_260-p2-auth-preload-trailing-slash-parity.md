---
id: FG_260
title: "All auth preloads use the trailing-slash-sanitized Convex URL"
date: 2026-05-18
type: fix
status: completed
priority: p2
description: "Only preloadAuthOptionalQuery passes the withoutTrailingSlash-sanitized convexUrl, so preloadAuthQuery and fetchAuthQuery still build URLs from the raw env and SSR detail and profile preloads fail when the deployment URL has a trailing slash."
dependencies: []
acceptance_criteria:
  - "preloadAuthQuery and fetchAuthQuery as exported from apps/mirror/lib/auth-server.ts route through wrappers that inject the sanitized url: convexUrl"
  - "`grep -c \"url: convexUrl\" apps/mirror/lib/auth-server.ts` returns a count greater than 1 (not only the preloadAuthOptionalQuery call site)"
  - "`pnpm --filter=@feel-good/mirror build` passes"
  - "A test asserts that with NEXT_PUBLIC_CONVEX_URL ending in '/', the value passed downstream by the auth-server preload helpers has no trailing slash"
---

# All auth preloads use the trailing-slash-sanitized Convex URL

## Context

This branch hardened URL handling with `withoutTrailingSlash`. `preloadAuthOptionalQuery` (apps/mirror/lib/auth-server.ts) explicitly passes `{ token, url: convexUrl }` where `convexUrl` is the sanitized `clientEnv.NEXT_PUBLIC_CONVEX_URL`. But the library-provided `preloadAuthQuery` and `fetchAuthQuery` exported at auth-server.ts:19-21 pass only `{ token }` and let `convex/nextjs` read `process.env.NEXT_PUBLIC_CONVEX_URL` raw — which is never stripped (only `clientEnv` is).

Found in code review (correctness reviewer, confidence 0.78). The hardening is asymmetric: with a trailing-slash deployment env, SSR preloads for article/post detail and profile (which use `preloadAuthQuery`/`fetchAuthQuery`) construct `…convex.cloud//api/…` and fail, while list/bio (`preloadAuthOptionalQuery`) succeed.

## Scope

- Wrap the exported `preloadAuthQuery` and `fetchAuthQuery` so they inject the sanitized `url: convexUrl`, the same way `preloadAuthOptionalQuery` does.

## Approach

Add thin wrappers in `apps/mirror/lib/auth-server.ts` around the `createAuthServerUtils` `preloadAuthQuery`/`fetchAuthQuery` that merge `{ url: convexUrl }` into the options argument, and export the wrapped versions under the same names so call sites are unchanged.

## Implementation Steps

1. Read `apps/mirror/lib/auth-server.ts` and how `createAuthServerUtils`'s `preloadAuthQuery`/`fetchAuthQuery` accept their options argument.
2. Add wrappers injecting `{ url: convexUrl }`; re-export under the existing names so call sites are unchanged.
3. Add/extend a test asserting a trailing-slash `NEXT_PUBLIC_CONVEX_URL` yields a slash-free downstream url from these helpers.
4. Run `pnpm --filter=@feel-good/mirror build`.

## Resources

- workspace/lessons.md 2026-05-15 "Test URL envs should tolerate trailing slashes"
- Reference call site already correct: `preloadAuthOptionalQuery` (same file)
