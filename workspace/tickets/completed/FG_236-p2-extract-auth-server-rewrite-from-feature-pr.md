---
id: FG_236
title: "Restore createAuthServerUtils destructuring in lib/auth-server.ts"
date: 2026-05-15
type: refactor
status: completed
priority: p2
branch: hpark0011/post-edit-delete
verification_tier: 1
description: "This PR replaced a three-line destructured export from createAuthServerUtils with two 12-line hand-written async wrappers for preloadAuthQuery and fetchAuthQuery. The structural change is unrelated to the post-list-actions feature and was bundled in unannounced. If createAuthServerUtils's signature evolves, the manually-written wrappers will silently diverge — the factory was the right abstraction boundary."
dependencies:
  - FG_231
acceptance_criteria:
  - "apps/mirror/lib/auth-server.ts imports preloadAuthQuery and fetchAuthQuery from createAuthServerUtils via destructuring (not hand-written)"
  - "If trailing-slash defense is still required, it lives in createAuthServerUtils (or its callers pass the stripped value at the factory's input) — not in re-implemented wrappers"
  - "pnpm build --filter=@feel-good/mirror passes"
  - "All consumers of preloadAuthQuery and fetchAuthQuery in apps/mirror still resolve types correctly"
---

# Restore createAuthServerUtils destructuring in lib/auth-server.ts

## Context

Surfaced in code review of branch `hpark0011/post-edit-delete`. Old code at `lib/auth-server.ts` was a single destructuring export:

```ts
export const { handler, isAuthenticated, getToken, preloadAuthQuery, fetchAuthQuery } =
  createAuthServerUtils({ convexUrl, convexSiteUrl });
```

The diff replaces `preloadAuthQuery` and `fetchAuthQuery` with hand-written wrappers (lines 18-46) that thread `url: convexUrl` explicitly. The rewrite is not mentioned in the post-list-actions plan and effectively re-implements the factory's generic logic.

## Scope

- Restore the destructuring pattern.
- Keep the trailing-slash defense (the original motivation) at the factory input or in `createAuthServerUtils` itself.

## Approach

Two options:
1. Pass the already-stripped `convexUrl` from `clientEnv` into `createAuthServerUtils({ convexUrl, convexSiteUrl })`. The factory should already thread that through to its internal `preloadQuery`/`fetchQuery` calls. Verify this is the case in `@feel-good/features/auth/server`.
2. If the factory does NOT thread `convexUrl` to its internal Convex calls, file a follow-up against `packages/features/auth/server` to fix it there instead of in `apps/mirror`.

Resolves the `process.env` mutation finding (FG_231) cleanly because nothing in this file needs to mutate env.

## Implementation Steps

1. Read `packages/features/auth/server` (wherever `createAuthServerUtils` lives) to confirm whether `convexUrl` is forwarded to its internal `preloadQuery`/`fetchQuery` calls.
2. If yes: restore destructured exports for `preloadAuthQuery` and `fetchAuthQuery`; delete the hand-written wrappers and the `process.env` mutation.
3. If no: file an upstream ticket against `@feel-good/features`. Leave a TODO + brief comment in `lib/auth-server.ts` pointing at the upstream ticket; the manual wrappers stay until the upstream is fixed.
4. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Land after FG_231 (which deletes the `process.env` mutation) — the two are coupled.
