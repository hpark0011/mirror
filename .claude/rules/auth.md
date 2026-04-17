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

## Preview deployments on Vercel

Vercel builds every PR as a Preview. The build command invokes `npx convex deploy` unconditionally — which means a PR build that isn't set up for previews fails hard (exit 1, `no Convex deployment configuration found`). This whole setup is a one-time ops chore, but easy to get wrong in subtle ways.

Six steps, in order. Skipping any one breaks the preview:

1. **Generate a Convex Preview Deploy Key** in the Convex dashboard → **Project Settings** (click the project name in the top-left breadcrumb to get out of the Production deployment view; the key is a *project-level* artifact, not a deployment-level one). The key's format is `preview:<team-slug>:<project-slug>|<token>`.
2. **Register the key on Vercel as `CONVEX_DEPLOY_KEY` — Preview scope only.** Do *not* overwrite or share scope with the Production key; a Preview-scoped key deploys ephemeral per-PR backends, a Production-scoped key deploys prod.
3. **Use the Vercel dashboard, not `vercel env add`, for this one.** The CLI's `vercel env add NAME preview` supports branch scoping via `preview:<branch>` syntax, so a value containing colons (which Convex preview keys do — `preview:<team>:<project>|…`) gets mis-parsed as `preview` + branch `<team>:<project>|…` and fails with "Branch ... not found in the connected Git repository". The dashboard has separate Value and Environment fields and avoids the ambiguity.
4. **Seed Convex Project-level Default Environment Variables** for every var our `packages/convex/convex/env.ts` zod schema requires: `SITE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Every new preview backend spawns empty; these defaults are what populate it on creation. Placeholders are fine (`https://preview.placeholder.invalid`, non-empty strings) — auth won't work on preview URLs anyway because the OAuth redirect URIs are app-domain-specific.
5. **Defaults only apply to NEWLY-created preview deployments.** A preview deploy that failed before you set the defaults won't retroactively get them — push an empty commit (`git commit --allow-empty && git push`) to force Convex to provision a fresh backend that picks the defaults up.
6. **Preview deploy URL behavior you should expect:** the app loads, Convex queries/mutations/streaming work, email-OTP sign-in works, but Google OAuth sign-in fails at callback (redirect-URI mismatch — Google's client has prod/dev domains whitelisted, not `mirror-<hash>-hpark0011s-projects.vercel.app`). If preview-auth matters for review, provision a dedicated "preview" Google OAuth client with the preview-URL pattern authorized and swap the placeholders for its real credentials.

Preview backends auto-clean after 5 days (14 on Convex Pro) and count toward the project's deployment limit.

## Middleware runtime

`apps/mirror/middleware.ts` imports `better-auth/cookies` (`getSessionCookie`). It's a pure cookie reader — safe on the default Edge Runtime, no `runtime: 'nodejs'` needed. If you add any Better Auth call that uses Node APIs (rare), declare `runtime: 'nodejs'` on the middleware config.
