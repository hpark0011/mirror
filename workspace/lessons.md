# Lessons Learned

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
