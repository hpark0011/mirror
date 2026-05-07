---
id: PLAN_009
slug: worktree-google-auth
title: "Fix Google auth on dynamic worktree ports"
date: 2026-05-07
type: fix
status: draft
branch: codex/fix-worktree-google-auth
worktree: /Users/disquiet/.codex/worktrees/e921/mirror
scope: "Make Better Auth and Google OAuth work reliably when Mirror dev servers run on per-worktree localhost ports."
apps: [mirror]
packages: [convex, features]
verification_tier: 5
---

## Context

Recent worktree changes introduced two independent local-development axes:

- PR #54 made Mirror allocate a stable per-worktree port instead of always using `localhost:3001`.
- PR #56 made each worktree provision its own Convex deployment and copy Convex env secrets into that deployment.

The current auth config still assumes one canonical app origin:

- `packages/convex/convex/auth/client.ts` sets Better Auth `baseURL: env.SITE_URL` and `trustedOrigins: [env.SITE_URL]`.
- Worktree dev can run at `http://localhost:<allocated-port>`, for example `http://localhost:3350`.
- The Convex deployment may still have `SITE_URL=http://localhost:3001`, so Google OAuth redirects are generated for `localhost:3001` even when the app is served elsewhere.

Official docs point to two relevant patterns:

- Better Auth Dynamic Base URL for apps served from multiple hosts or branch environments: `baseURL` can be an allowlisted object, and allowed hosts are automatically added to trusted origins. Docs: https://better-auth.com/docs/guides/dynamic-base-url
- Better Auth OAuth Proxy for preview and development servers where the OAuth provider callback URL cannot be known in advance. Docs: https://better-auth.com/docs/plugins/oauth-proxy
- Convex env vars are per deployment, so every worktree deployment must receive the required auth env vars. Docs: https://docs.convex.dev/production/environment-variables

## Goal

Google sign-in must work from any Mirror worktree dev URL allocated by `scripts/with-worktree-port.mjs`, without requiring each individual local port to be manually added to Google OAuth.

The generated auth flow should:

- accept the current worktree origin as a trusted Better Auth origin,
- construct callback and post-auth URLs from the actual forwarded app host,
- route Google OAuth through a stable registered callback when needed,
- keep per-worktree Convex deployments isolated.

## Proposed Design

Use Better Auth Dynamic Base URL as the base model and OAuth Proxy for Google/social OAuth.

Dynamic Base URL handles the Better Auth side:

```ts
baseURL: {
  allowedHosts: [
    "localhost:*",
    "127.0.0.1:*",
    "greymirror.ai",
    "*.vercel.app",
  ],
  protocol: process.env.NODE_ENV === "development" ? "http" : "https",
}
```

OAuth Proxy handles the Google side:

```ts
plugins: [
  oAuthProxy({
    productionURL: env.OAUTH_PROXY_PRODUCTION_URL,
  }),
  convex({ authConfig }),
];
```

This means local and preview environments can start OAuth from their own host, but the OAuth provider only needs the stable production callback URL registered.

## Implementation Steps

1. Add Convex env support for dynamic auth host settings.

   Update `packages/convex/convex/env.ts` to accept:
   - `SITE_URL` as the fallback canonical URL for existing environments.
   - `AUTH_ALLOWED_HOSTS`, a comma-separated host allowlist. Default for local/dev should include `localhost:*` and `127.0.0.1:*`.
   - `OAUTH_PROXY_PRODUCTION_URL`, optional. Required only when OAuth proxy mode is enabled.
   - `OAUTH_PROXY_ENABLED`, optional boolean-like string to avoid accidentally enabling the proxy where it is not configured.

2. Add a small parser in Convex auth code.

   Create a helper near `packages/convex/convex/auth/client.ts` or in `packages/convex/convex/auth/config.ts` that:
   - parses comma-separated env vars,
   - trims empty entries,
   - keeps `SITE_URL` as fallback,
   - derives `baseURL` as a Better Auth dynamic object when `AUTH_ALLOWED_HOSTS` is set,
   - keeps the static string path for production-only or legacy deployments.

3. Update Better Auth config.

   In `packages/convex/convex/auth/client.ts`:
   - replace static `baseURL: env.SITE_URL` with the derived dynamic/static base URL,
   - remove duplicated `trustedOrigins: [env.SITE_URL]` when using dynamic base URL because Better Auth adds allowed hosts to trusted origins,
   - preserve explicit `trustedOrigins` only for extra origins that are not represented as hosts,
   - add `oAuthProxy` from `better-auth/plugins` when `OAUTH_PROXY_ENABLED=true`.

4. Update worktree provisioning scripts.

   Update `scripts/sync-worktree-convex-secrets.sh` so new per-worktree deployments receive the new auth env keys from main:
   - `AUTH_ALLOWED_HOSTS`
   - `OAUTH_PROXY_ENABLED`
   - `OAUTH_PROXY_PRODUCTION_URL`

   Update `scripts/restore-env-local.sh` and `.env.local.example` comments to explain:
   - `NEXT_PUBLIC_SITE_URL` is the current frontend URL and can be overridden by `with-worktree-port.mjs`,
   - Convex `SITE_URL` is only a fallback when dynamic base URL is not configured,
   - Google OAuth should not depend on every local port being registered.

5. Update docs and worktree instructions.

   Update `.claude/rules/worktrees.md` and new-worktree skill text to add an auth setup section:
   - after provisioning a worktree deployment, run `./scripts/sync-worktree-convex-secrets.sh`,
   - verify `convex env list` includes the auth host/proxy keys,
   - use OAuth Proxy or fixed-port mode for Google auth testing.

6. Add focused unit tests for config derivation.

   Add tests under `packages/convex/convex/auth/__tests__/` for:
   - static fallback: only `SITE_URL` set returns static `baseURL`,
   - dynamic mode: `AUTH_ALLOWED_HOSTS=localhost:*,127.0.0.1:*` returns dynamic `baseURL`,
   - proxy disabled: no OAuth proxy plugin when not explicitly enabled,
   - proxy enabled without production URL fails fast with a clear error.

7. Add an E2E regression test for dynamic worktree ports.

   Add a Playwright CLI test in `apps/mirror/e2e/auth-worktree-port.spec.ts` that:
   - launches Mirror on an explicit non-3001 port such as `MIRROR_PORT=3350`,
   - visits `/sign-in`,
   - clicks "Continue with Google",
   - intercepts or observes `/api/auth/sign-in/social`,
   - asserts the generated auth URL no longer uses `redirect_uri=http://localhost:3001/...` when running on another port,
   - if OAuth Proxy is enabled, asserts the provider redirect uses the configured production callback while preserving the local callback target in proxy state.

## Hard Verification

Run:

```bash
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
pnpm --filter=@feel-good/convex test
MIRROR_PORT=3350 pnpm --filter=@feel-good/mirror exec playwright test e2e/auth-worktree-port.spec.ts
```

Manual smoke check:

```bash
MIRROR_PORT=3350 pnpm --filter=@feel-good/mirror dev
```

Then open `http://localhost:3350/sign-in`, click "Continue with Google", and confirm:

- the UI leaves the sign-in page or shows the expected Google page,
- the browser console has no auth 403,
- the generated OAuth URL is not incorrectly pinned to `localhost:3001`.

Because this is Tier 5, keep the Playwright CLI test as the hard assertion. Browser interaction is supporting evidence only.

## Constraints

- Do not disable CSRF or origin checks. Better Auth explicitly marks those as security risks.
- Do not trust arbitrary forwarded hosts. Use Better Auth's `allowedHosts` allowlist.
- Do not make every worktree share a Convex deployment again. The per-worktree deployment isolation from PR #56 must remain.
- Do not require manual Google Console updates for every generated worktree port.
- Keep production behavior stable. Production should either use static `SITE_URL` or an explicit production host allowlist.

## Non-Goals

- No change to the beta allowlist policy.
- No change to Better Auth database schema.
- No replacement of Convex + Better Auth.
- No attempt to make local Convex deployments publicly reachable.

## Rollout

1. Land dynamic Better Auth config with OAuth Proxy support disabled by default.
2. Configure main/dev Convex env defaults:

   ```bash
   pnpm --filter=@feel-good/convex exec convex env set AUTH_ALLOWED_HOSTS "localhost:*,127.0.0.1:*,greymirror.ai,*.vercel.app"
   pnpm --filter=@feel-good/convex exec convex env set OAUTH_PROXY_ENABLED "true"
   pnpm --filter=@feel-good/convex exec convex env set OAUTH_PROXY_PRODUCTION_URL "https://greymirror.ai"
   ```

3. Ensure Google OAuth has the production callback registered:

   ```text
   https://greymirror.ai/api/auth/callback/google
   ```

4. Re-run `./scripts/sync-worktree-convex-secrets.sh` in existing worktrees.
5. Run the hard verification commands on a non-3001 port.

## Open Questions

- Confirm the production canonical auth URL: `https://greymirror.ai` versus another Vercel/custom domain.
- Confirm whether OAuth Proxy should be enabled for all dev and preview deployments, or only local worktrees.
- Confirm whether `localhost:*` is accepted by the installed Better Auth version exactly as documented, or whether the implementation requires enumerated hosts. If the latter, generate a bounded allowlist matching `scripts/with-worktree-port.mjs`'s `3100-3799` range.
