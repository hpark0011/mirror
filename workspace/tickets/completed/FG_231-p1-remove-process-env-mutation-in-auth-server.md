---
id: FG_231
title: "Remove module-level process.env mutation in lib/auth-server.ts"
date: 2026-05-15
type: refactor
status: completed
priority: p1
branch: hpark0011/post-edit-delete
verification_tier: 1
description: "lib/auth-server.ts line 9 writes process.env.NEXT_PUBLIC_CONVEX_URL = convexUrl at module load. All three Convex helpers in the same file already pass url: convexUrl explicitly, so the mutation is dead at this call site and creates a hidden import-order coupling for any future caller that imports from convex/nextjs without an explicit url option. Three independent reviewers (correctness, convention, maintainability) flagged this."
dependencies: []
acceptance_criteria:
  - "grep -n 'process.env.NEXT_PUBLIC_CONVEX_URL' apps/mirror/lib/auth-server.ts returns no write/assignment matches"
  - "pnpm build --filter=@feel-good/mirror passes"
  - "pnpm lint --filter=@feel-good/mirror passes"
  - "All three exported helpers (preloadAuthQuery, fetchAuthQuery, preloadAuthOptionalQuery) still pass { token, url: convexUrl } explicitly"
---

# Remove module-level process.env mutation in lib/auth-server.ts

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. `apps/mirror/lib/auth-server.ts:9` reads `convexUrl` from `clientEnv` (already trailing-slash-stripped) and writes it back to `process.env.NEXT_PUBLIC_CONVEX_URL` on import. Every Convex SDK call in the same file (`preloadAuthQuery`, `fetchAuthQuery`, `preloadAuthOptionalQuery`) already passes `{ url: convexUrl }` explicitly, so the env write does nothing for the helpers in this module. It does create a silent ordering dependency: any future caller that imports `preloadQuery`/`fetchQuery` from `convex/nextjs` directly will only see the stripped value if `auth-server.ts` was evaluated first.

Reviewers cited: correctness (P3/0.85), convention (P2/0.85), maintainability (P1/0.92). Merged confidence after agreement boost: 0.98. `.claude/rules/providers.md` discourages this style of env handling.

## Scope

- Delete line 9 of `lib/auth-server.ts`.
- Verify no other module in the app depends on the side effect.

## Approach

Delete the single mutation line. The explicit `url: convexUrl` already threaded through every call site is the correct and self-documenting fix.

## Implementation Steps

1. Remove `process.env.NEXT_PUBLIC_CONVEX_URL = convexUrl;` from `apps/mirror/lib/auth-server.ts:9`.
2. `grep -rn 'process.env.NEXT_PUBLIC_CONVEX_URL' apps/mirror/` to confirm no other module reads it expecting the strip.
3. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
