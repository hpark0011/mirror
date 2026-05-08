# Lessons Learned

## 2026-05-08

### Idempotent setup scripts must verify post-conditions, not trust subshell exit codes

- `sync-worktree-convex-secrets.sh` ran a `convex run` mutation inside `(...)`
  with `set -e` to auto-allowlist the worktree owner. The subshell silently
  swallowed the failure, the script printed "Allowlisted: …" and exited 0, but
  the row was never written — the user only learned about it minutes later
  when Google OAuth redirected back with the opaque
  `?error=unable_to_create_user`.
- Two patches lock this down: (1) run the mutation outside any subshell with
  an explicit `if !` failure check, and (2) immediately re-query
  `betaAllowlist/queries:isEmailAllowed` and fail loudly if it returns
  anything other than `true`. The second check also catches the "wrote to a
  different deployment" mode (stale `CONVEX_DEPLOYMENT`, CLI auth drift) that
  exit-code checks can never detect.
- Pattern beyond this script: any setup step that mutates remote state and
  reports success should re-read its own write before exiting. Exit codes
  prove "the call returned" — they do not prove "the row landed where I think
  it did."

## 2026-05-07

### RHF migrations must preserve every former state write

- When replacing local `useState` fields with React Hook Form, audit every old
  setter call and preserve its semantic equivalent. A mutation path that used
  to call `setStatus(nextStatus)` after a successful publish toggle must now
  call `form.setValue("status", nextStatus)`; otherwise watched UI state and
  later submit payloads can silently fall back to the stale pre-submit value.

### Claude-to-agents skill sync must preserve Convex symlink targets

- `.claude/skills/convex*` entries are symlinks back to tracked real
  directories under `.agents/skills/convex*`. When syncing `.claude` to
  `.agents`, do not copy those symlinks onto their own targets; exclude them
  from blanket rsync and preserve/restore the tracked `.agents` directories.

## 2026-05-06

### Codex worktree setup must support single-checkout clones

- Setup scripts cannot assume `git worktree list` includes a `main` worktree.
  Codex review checkouts and fresh single-worktree clones are often checked out
  directly on the feature branch, so environment setup must fall back to the
  current checkout for dependency installation. Keep canonical `.env.local`
  checks strict for secondary worktree creation, but do not block standalone
  installs before the user has a chance to seed local env files.

### PR hygiene — keep cosmetic tweaks out of feat/refactor PRs

- Cosmetic/visual tweaks (e.g. a `py-12 → py-10` swap on `post-list-item`)
  must ship in their own commit and PR. Bundling them into a `feat`/
  `refactor` PR pollutes the bisect history (a future investigation of a
  post-list spacing regression will land on a "feat(articles): add Edit
  button" commit and waste investigation time) and breaks the trust that
  PR titles summarize the change set.
- Surfaced by FG_158 after PR #39 silently included a `py-12 → py-10`
  change on `apps/mirror/features/posts/components/list/post-list-item.tsx`
  alongside the article Edit button + back-button refactor commits.

## 2026-05-05

### Convex client-auth race in authenticated Playwright specs

- `ConvexBetterAuthProvider` installs the JWT in an `useEffect` AFTER mount: read Better Auth session → `await authClient.convex.token()` → `client.setAuth(...)`. Any `useMutation(...)` fired during those microtasks (e.g. an inline-image upload-URL generator triggered by the FIRST paste in an authenticated spec) hits `Unauthenticated` even though the session cookie is already on the browser. Pre-warming `/api/auth/convex/token` does not help — the gap is the client effect, not the network round-trip.
- The deterministic signal is `<ConvexAuthProbe>` (`apps/mirror/providers/convex-auth-probe.tsx`) — an inert `<span data-testid="convex-auth-state" data-authenticated="true">` that flips only after `client.setAuth`'s onChange callback fires. The probe is mounted globally via `apps/mirror/providers/convex-provider.tsx` and is ~zero cost in production.
- **Authenticated-spec rule:** every authenticated Playwright spec MUST call `await waitForAuthReady(page)` (from `apps/mirror/e2e/fixtures/auth.ts`) AFTER `page.goto(...)` and BEFORE the first interaction that triggers a Convex mutation (paste, drop, save, dialog submit). Do NOT copy-paste the wait logic per spec — the helper is the single source of truth so future regressions are one fixture edit away from re-fixing every consumer.
- The fixture file's docstring carries the same root-cause writeup co-located with the helper itself for fast discovery from the call site.
- Agent tool flows that need "lookup, then act" require an explicit AI SDK
  step budget (`stopWhen: stepCountIs(...)`). The default one-step loop can
  execute the lookup tool and stop before the action tool is ever called.
- "Latest published" content must order by `publishedAt`, not row creation
  time. Drafts can be created long before they are published, so use an index
  that includes the semantic publish timestamp whenever UI or agent language
  says "latest".

### Authenticated Playwright specs need a deterministic ConvexAuth-ready signal

`ConvexBetterAuthProvider` installs the JWT in a *post-mount* effect:
`authClient.useSession()` resolves → `fetchAccessToken()` round-trips
`/api/auth/convex/token` → `client.setAuth(...)` flips
`useConvexAuth().isAuthenticated` to `true`. Any `useMutation(...)` fired
during those microtasks (the inline-image upload-URL generator, the
post-create mutation, etc.) hits `Unauthenticated` even though the
session cookie is already set on the browser. Pre-warming
`/api/auth/convex/token` via `app/api/test/session` does NOT help — the
cookie is already present; the gap is the client-side effect, not the
network.

The fix is one inert probe + one fixture helper, applied uniformly:

- `apps/mirror/providers/convex-auth-probe.tsx` mounts a hidden `<span
  data-testid="convex-auth-state" data-authenticated="…">` that mirrors
  `useConvexAuth()`. It's `aria-hidden` and `display:none` so the
  production cost is one tiny element render.
- `apps/mirror/e2e/fixtures/auth.ts` exports `waitForAuthReady(page)`,
  which waits for `[data-authenticated="true"]` to attach. Authenticated
  specs call it AFTER `page.goto(...)` and BEFORE the first interaction
  that triggers a `useMutation(...)` (paste, drop, save, dialog submit).

When you add a new authenticated spec that interacts with a Convex
mutation: import `waitForAuthReady` from `./fixtures/auth`, call it once
per page navigation, and you're safe. Don't try to re-derive readiness
from network requests — the token cookie may already be set, so no
second `/api/auth/convex/token` request fires; the only deterministic
signal is the `useConvexAuth` boolean mirrored into the DOM.

## 2026-05-03

- For Convex env sync helpers, preserve the CLI's round-trip format instead
  of parsing `convex env list` line by line. Convex 1.33+ intentionally
  supports `convex env list > file` plus `convex env set --force < file`,
  which keeps multi-line secrets intact and avoids bespoke parser drift.
- Inline storage cascade deletes must prove a blob is globally unreferenced after the write lands, not merely removed from the current body. Same-owner copy/paste can leave the same `storageId` in another article or post, so immediate cleanup needs a current article/post/user reference scan before `ctx.storage.delete`.
- When a hook records a result in React state and the caller must branch on it immediately, return the result as well. Relying on just-set state from the connector can race the close/reset path and hide user-visible import failures.
- "Always Choose the Compounding Option" means *less error-prone over time*, not *abstractly cleaner architecture*. Following the framework's idiom (e.g. the convex CLI's per-package `.env.local` auto-write) compounds; fighting it with custom config (`--env-file`, version pins, relative-path coupling) accumulates bespoke complexity even when it eliminates duplication. Single-source-of-truth appeal is real but it's a tradeoff, not a trump card — ask whether the proposed shape stays on the well-trodden path that future framework releases will keep working without intervention.
- When fixing a symptom, also patch the **class** upstream. The "`convex dev` prompts every new worktree" symptom was solved by re-seeding one file; the class — `new-worktree.sh` silently producing a half-configured worktree if any required `.env.local` is missing in main — was solved by adding a `REQUIRED_ENVS` assertion at the top of the script with per-file seed hints. Patching the script means the next missing-canonical-file (a future package's `.env.local`) can't repeat the same surprise.
- Verify CLI flag behavior on the **installed version**, not the latest changelog. `convex 1.32` ships `--env-file` but the 1.33 changelog patches it for "more reliability" — translation: there's a known bug in 1.32. Recommending a flag-based fix without checking the installed version's reliability history nearly shipped a broken solution.

## 2026-04-29

### `[username]/page.tsx` body is never executed — put bare-profile redirects in middleware

- `app/[username]/layout.tsx` deliberately discards `children` (`children: _children` + `void _children`) so the parallel-route slots (`@content`, `@interaction`) own the render tree. **Side effect:** Next.js 16 / Turbopack does NOT execute `page.tsx` for `/[username]` — its body never runs, so `redirect()` or `throw` in there is a silent no-op. The pre-existing mobile-only redirect block in page.tsx was dead code for this reason and was never actually firing.
- Verified empirically: `throw new Error(...)` in `page.tsx` returns 200 (not 500); rendering `{_children}` somewhere in the layout flips that back to 500. So the layout's "discard children" pattern fully suppresses the page render.
- **Where to put bare `/@username` → `/@username/<tab>` redirects:** `apps/mirror/middleware.ts`, not page.tsx. Middleware runs before the parallel-route system. Match `^/@[^/]+/?$` to scope to the bare profile path. Forward `request.nextUrl.search` to preserve query strings.
- **Always verify redirects in the browser/curl, not just by reading code.** If the redirect call sits in a route Next.js never renders, type-checking and lint pass clean while the URL silently stays put.

## 2026-02-24

### Auth integration requires end-to-end browser verification

- **Build passing is not verification for auth/data flows.** `tsc --noEmit` and `pnpm build` cannot detect that a Convex provider isn't passing auth tokens. Always load the page in a browser and confirm the actual user-visible behavior.
- **Trace the full data flow before declaring a fix.** For auth-dependent pages: Browser → Provider (token fetch) → Convex query → DB lookup. Check each hop, not just the code you changed.
- **Start debugging from the user's perspective.** Screenshot/observe the page first, then reason about code. Going code-first led to three rounds of investigation instead of one.
- **`convex data <table>` is the fastest way to diagnose null-query issues.** Use it immediately when a Convex query returns unexpected nulls.

### Data migration is a first-class concern

- When adding triggers/hooks that create records on entity creation, always ask: "What about entities that already exist?" Build a backfill path (e.g., `ensureProfile` mutation) alongside the trigger.
- Dead code is a red flag. If a null guard can never execute because the preceding call throws, the function's contract is wrong.

### Convex + Better Auth client setup

- `ConvexProvider` (plain) does NOT pass auth tokens. Must use `ConvexBetterAuthProvider` from `@convex-dev/better-auth/react` with the `authClient` to bridge Better Auth sessions into Convex auth context.
- `getAuthUser` throws `ConvexError("Unauthenticated")` — use `safeGetAuthUser` in queries that need to gracefully handle unauthenticated state. Keep `getAuthUser` in mutations that require auth.

## 2026-02-13

- If a transition bug reproduces only at extreme scroll positions (top works, bottom fails), treat it as a scroll-state/timing issue first (`useLayoutEffect` + `ViewTransition` + `scrollTo` ordering), not as static toolbar styling/geometry.
- Before patching visual styles, validate the hypothesis against the reported repro axis (e.g., scroll position dependence). If a proposed fix would affect all scroll positions equally, it is likely the wrong root cause for a bottom-only bug.

## 2026-02-12

- When a model has both `published_at` and `created_at`, do not assume one generic date filter; confirm whether each date needs its own submenu and separate owner-visibility rules.
- For toolbar filter UIs, default root "filter by..." search to narrowing dropdown options only unless the user explicitly wants it to affect the list query.

## 2026-02-09

- When using `@feel-good/ui/primitives/drawer`, every `DrawerContent` must include a `DrawerTitle` (can be hidden with `sr-only` via `DrawerHeader`) to satisfy Radix Dialog accessibility requirements and avoid runtime accessibility errors.
