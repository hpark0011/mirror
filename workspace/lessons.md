# Lessons Learned

## 2026-05-03

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
