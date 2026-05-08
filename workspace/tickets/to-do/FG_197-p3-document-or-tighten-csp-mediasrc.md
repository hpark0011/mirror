---
id: FG_197
title: "Document or tighten CSP media-src wildcard for Convex hosts"
date: 2026-05-08
type: chore
status: to-do
priority: p3
description: "media-src now allows any *.convex.cloud / *.convex.site deployment, not just our own. img-src and connect-src already have the same wildcard so this is consistent rather than novel attack surface, but it's wider than strictly necessary. Either scope to the deployment subdomain or document the consistency rationale."
dependencies: []
parent_plan_id: PLAN_010
acceptance_criteria:
  - "Either: media-src is scoped to the deployment-specific subdomain via a build-time env-var substitution, OR a comment above the cspDirectives array in next.config.ts explains why the *.convex.cloud wildcard is acceptable (consistency with img-src/connect-src and the unguessable storage IDs)"
  - "If scoping is chosen, the corresponding scoping is applied to img-src and connect-src for consistency"
  - "`pnpm --filter=@feel-good/mirror build` produces valid CSP headers"
  - "Manual Chrome MCP: load a page with a Convex-hosted video, confirm no CSP violation"
owner_agent: "Security Engineer"
---

# Document or Tighten CSP media-src Wildcard for Convex Hosts

## Context

`apps/mirror/next.config.ts:12` adds `https://*.convex.cloud https://*.convex.site` to the `media-src` directive:

```
media-src 'self' https://*.daily.co https://*.convex.cloud https://*.convex.site blob:
```

The wildcards trust ANY Convex deployment, not just the production deployment that hosts our user content. `img-src` (line 8) and `connect-src` (line 10) already have the same wildcard, so this addition is consistent with the pre-existing trust posture rather than a novel expansion.

Two options:

1. **Tighten:** if the deployment URL is known at build time (and it is — `NEXT_PUBLIC_CONVEX_URL` is build-inlined per `.claude/rules/auth.md`), substitute the specific subdomain. This narrows the trust boundary but requires applying the same scoping to `img-src` and `connect-src` for consistency.

2. **Document:** add a comment explaining why the wildcard is acceptable (storage IDs are unguessable; Convex doesn't host user-controlled subdomains; the consistency with `img-src` is intentional).

Either resolution is fine. The current state — wildcard with no rationale comment — is the worst of both worlds.

- **Source:** Code review of PLAN_010 article-cover-video branch
- **Location:** `apps/mirror/next.config.ts:12`
- **Evidence:** Wildcard host pattern; no inline rationale.

## Goal

The CSP `media-src` directive is either narrower (deployment-specific) or has an inline rationale comment explaining the wildcard.

## Scope

- Pick option 1 (tighten) or option 2 (document).
- Apply consistently with `img-src` and `connect-src`.

## Out of Scope

- Tightening other directives (script-src, style-src, etc.) — separate audit.
- Adding CSP violation reporting endpoint.

## Approach

**Option 1 (preferred if feasible):** parse the host from `NEXT_PUBLIC_CONVEX_URL` at build time and substitute into the CSP. The host pattern is `<deployment-id>.convex.cloud` — extract via URL parsing.

```ts
const convexHost = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud").host;
const cspDirectives = [
  …,
  `img-src 'self' https://images.unsplash.com https://${convexHost} https://${convexHost.replace('.convex.cloud', '.convex.site')} ... data: blob:`,
  `connect-src 'self' https://${convexHost} wss://${convexHost} ...`,
  `media-src 'self' https://*.daily.co https://${convexHost} https://${convexHost.replace('.convex.cloud', '.convex.site')} blob:`,
  …,
].join("; ");
```

Caveat: dev and prod use different deployments. Build-time substitution is fine for prod; for dev (where `next dev` doesn't apply CSP anyway) the wildcard never matters.

**Option 2 (acceptable):**
```ts
// Convex storage host is wildcarded because (a) NEXT_PUBLIC_CONVEX_URL is
// the same single domain across all production traffic, (b) Convex doesn't
// host user-controlled subdomains, (c) storage IDs are cryptographically
// opaque so cross-tenant URL guessing is infeasible. img-src and connect-src
// carry the same wildcard for the same reasons.
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Pick option 1 or 2.
2. Apply the chosen treatment to `next.config.ts`. If option 1, ensure dev mode doesn't break (CSP is bypassed in `next dev`).
3. Run `pnpm --filter=@feel-good/mirror build`.
4. Manual Chrome MCP: load an article detail page with a Convex-hosted video, confirm the video loads without a CSP violation in the console.
5. Verify no other directives need consistency updates.

## Constraints

- Don't break `next dev` (CSP isn't applied there, but build-time env-var resolution must still work).
- Don't introduce a runtime fetch for the convex URL — must be build-inlined.

## Resources

- Source: `apps/mirror/next.config.ts:4-14`
- `.claude/rules/auth.md` — env-var conventions for NEXT_PUBLIC_CONVEX_URL
