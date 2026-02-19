# Fix Mirror Video Internal Server Error + Zod Env Validation

## Context

Clicking the "Video" button in mirror triggers `POST /api/tavus/conversations`. This returns a 500 because `TAVUS_API_KEY` is read ad-hoc via `process.env` with a manual null check — the error surfaces only at request time with a generic message.

The mirror app already has a Zod-based client env validation pattern at `lib/env/client.ts`. We'll extend this with a server-side counterpart for Tavus env vars and update the API route to use validated env.

## Branch

`fix-mirror-video-error` (worktree: `.worktrees/fix-mirror-video-error`)

## Changes

### 1. Create `apps/mirror/lib/env/server.ts`

Follow the exact pattern of `client.ts`:

- `import "server-only"` guard at top (prevents client bundle leakage at build time)
- Zod schema validating:
  - `TAVUS_API_KEY` — required string, min length 1
  - `TAVUS_PERSONA_ID` — optional with default `"pdced222244b"` (centralizes the fallback currently inline in the route)
- `validateServerEnv()` with actionable error messages
- Module-level `export const serverEnv = validateServerEnv()` — validates once at import time, not per-request

### 2. Update `apps/mirror/lib/env/index.ts`

Add server env re-export:
```ts
export { serverEnv, type ServerEnv } from "./server";
```

Client code should continue importing from `@/lib/env/client` directly. If client code accidentally imports from `@/lib/env`, the `server-only` guard produces a build error — desired safety net.

### 3. Update `apps/mirror/app/api/tavus/conversations/route.ts`

- Remove manual `process.env.TAVUS_API_KEY` read + null check (lines 12-19)
- Remove inline `?? "pdced222244b"` fallback (line 21)
- Import `serverEnv` from `@/lib/env/server`
- Access `serverEnv.TAVUS_API_KEY` and `serverEnv.TAVUS_PERSONA_ID`

### 4. Copy `.env.local` to worktree

```bash
cp apps/mirror/.env.local .worktrees/fix-mirror-video-error/apps/mirror/.env.local
```

## Files

| File | Action |
|------|--------|
| `apps/mirror/lib/env/server.ts` | Create |
| `apps/mirror/lib/env/index.ts` | Modify |
| `apps/mirror/app/api/tavus/conversations/route.ts` | Modify |

## Out of Scope

- Modernizing `client.ts` Zod v3 → v4 syntax (works fine as-is)
- Adding t3-env (manual Zod approach already established, simpler)
- Validating build-time/CI env vars (Sentry, CONVEX_DEPLOYMENT, etc.)

## Verification

1. `pnpm build --filter=@feel-good/mirror` — no build errors
2. `pnpm lint --filter=@feel-good/mirror` — passes
3. Remove `TAVUS_API_KEY` from `.env.local`, restart dev → clear error at startup
4. Restore key, click Video button → no 500 error
