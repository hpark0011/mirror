---
paths:
  - "packages/convex/convex/auth/**"
  - "packages/convex/convex/http.ts"
  - "packages/convex/convex/env.ts"
  - "packages/convex/convex/betaAllowlist/**"
  - "packages/features/auth/**"
  - "apps/*/lib/auth-*.ts"
  - "apps/*/app/api/auth/**"
  - "apps/*/middleware.ts"
---

# Auth Rules

Better Auth runs inside Convex. Next.js only proxies `/api/auth/*` through to the Convex HTTP handler. Don't break that proxy — it's what lets session cookies land on the app domain instead of `*.convex.site`.

## Architecture — at a glance

```
browser → https://<app-domain>/api/auth/*
            └─ app/api/auth/[...all]/route.ts           (Next.js proxy,
                 = convexBetterAuthNextJs(...)            forwards with
                                                          x-forwarded-host)
            → https://<deployment>.convex.site/api/auth/*
                 └─ convex/http.ts                       (HTTP router)
                      └─ authComponent.registerRoutes    (Better Auth handler)
                           └─ convex/auth/client.ts      (betterAuth({...}))
```

## URL / domain conventions — who owns what

Four URL-ish env vars. Don't mix them up.

| Var | Lives in | Value | Used by |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel (build-time inlined) | App's public URL (e.g. `https://greymirror.ai`) | Browser — `lib/auth-client.ts` |
| `SITE_URL` | Convex deployment env | Same app URL | Better Auth `baseURL` + `trustedOrigins` + `cors.allowedOrigins` |
| `NEXT_PUBLIC_CONVEX_URL` | Vercel (build-time, injected by `npx convex deploy --cmd-url-env-var-name`) | `https://<deployment>.convex.cloud` | `ConvexReactClient` for queries/mutations/subscriptions |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Vercel | `https://<deployment>.convex.site` | The Next.js proxy's target for `/api/auth/*` |

Rules:
- `SITE_URL` on Convex **must** equal `NEXT_PUBLIC_SITE_URL` on Vercel. They're the same value in two places.
- `.convex.cloud` ≠ `.convex.site`. The RPC/WebSocket host is `.convex.cloud`; the HTTP-actions host (where Better Auth lives) is `.convex.site`. Swapping them silently breaks sign-in with no useful error.

## Where `trustedOrigins` and CORS go

`trustedOrigins` (on `betterAuth({...})`) is the single source of truth. The adapter sources the CORS allow-list from it automatically.

```ts
// packages/convex/convex/http.ts
authComponent.registerRoutes(http, createAuth, { cors: true });

// packages/convex/convex/auth/client.ts
betterAuth({
  baseURL: env.SITE_URL,
  trustedOrigins: [env.SITE_URL],  // ← CSRF check AND CORS allow-list
  ...
});
```

- `trustedOrigins` on `betterAuth({...})` handles CSRF-style origin checks on cookie-setting POSTs. The `@convex-dev/better-auth` adapter version we use **does not** accept `trustedOrigins` on `registerRoutes` — TypeScript will reject it.
- `cors` on `registerRoutes` gates the CORS wrapper itself:
  - `cors: true` — enable the wrapper; allowed origins = `trustedOrigins` from `betterAuth(...)`. This is what we want.
  - `cors: { allowedOrigins: [...] }` — same, but appends extra origins beyond `trustedOrigins`. Only use this if a non-app origin legitimately needs cookie-bearing access.
  - **Omitting `cors` entirely** skips the wrapper — the raw handler runs with no preflight/allow-origin headers at all. Don't do this.
- Don't point `baseURL` at `.convex.site`. The Next.js proxy rewrites `x-forwarded-host` so Better Auth thinks the app domain is the host; OAuth redirect URIs are built from `baseURL`, and Google only knows about the app domain.

## Google OAuth redirect URI

One URI per environment in Google Cloud Console → OAuth Client → Authorized redirect URIs:

```
https://<app-domain>/api/auth/callback/google
```

Not `*.convex.site/...`. The proxy makes `greymirror.ai` the effective host.

Matching **Authorized JavaScript origin** = `https://<app-domain>` (no path).

For local dev: `http://localhost:3001` (note the port — Mirror dev runs on `3001`, not `3000`).

## Beta allowlist — the `unable_to_create_user` footgun

`convex/auth/client.ts` `authComponent` has a `user.onCreate` trigger that throws `BETA_CLOSED: <email>` if the email isn't in `betaAllowlist`. Better Auth catches the throw and surfaces it to the browser as `?error=unable_to_create_user` on the redirect URL — no hint about the allowlist.

Tier-2 (`sendVerificationOTP` in `createAuth`) runs the same gate earlier, via `runSendVerificationOtpGate` — that path returns the more specific `BETA_CLOSED` code to the Better Auth client.

Both gates are bypassed by `isPlaywrightTestEmail(email)` (emails ending in the `TEST_EMAIL_SUFFIX`) — only when the `PLAYWRIGHT_TEST_SECRET` env var is also set. **Never set `PLAYWRIGHT_TEST_SECRET` on production Convex.** It unlocks the `/test/*` HTTP routes in `http.ts`.

### Add an email to the allowlist

```bash
cd packages/convex
CONVEX_DEPLOYMENT=dev:<your-dev-slug> \
  npx convex run --prod \
  betaAllowlist/mutations:addAllowlistEntry \
  '{"email":"user@example.com","note":"optional"}'
```

Drop `--prod` to write to dev. `CONVEX_DEPLOYMENT=dev:…` is only there so the CLI can identify the project.

## Secret handling

- `BETTER_AUTH_SECRET` is **different** between dev and prod deployments. Generate a fresh prod secret with `openssl rand -base64 32`. Never copy dev's. Rotating it invalidates all sessions.
- `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, and other backend secrets live **only in Convex env**, never on Vercel. Vercel is a dumb proxy.
- `PLAYWRIGHT_TEST_SECRET` — dev only. Production must not have it.

## Monorepo deploy gotcha

Vercel Root Directory is `apps/mirror`, but Convex functions live at `packages/convex/convex/`. The production build command walks up before invoking Convex:

```
cd ../../packages/convex
  && npx convex deploy
       --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
       --cmd "cd ../../apps/mirror && pnpm turbo run build --filter=@feel-good/mirror"
```

If you change Vercel's build command, the nested `cd` pattern must be preserved — `npx convex deploy` needs `./convex/` relative to its cwd, and the `--cmd` subprocess must then cd back to `apps/mirror` for `next build`.

Any new env var read by either Next or Convex must also be added to `turbo.json`'s `globalEnv` array — otherwise turbo filters it out before the build subprocess sees it.

## Middleware runtime

`apps/mirror/middleware.ts` imports `better-auth/cookies` (`getSessionCookie`). It's a pure cookie reader — safe on the default Edge Runtime, no `runtime: 'nodejs'` needed. If you add any Better Auth call that uses Node APIs (rare), declare `runtime: 'nodejs'` on the middleware config.
