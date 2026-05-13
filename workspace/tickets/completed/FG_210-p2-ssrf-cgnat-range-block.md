---
id: FG_210
title: "isBlockedIp blocks RFC 6598 CGNAT range 100.64.0.0/10"
date: 2026-05-13
type: fix
status: completed
priority: p2
description: "The IPv4 portion of isBlockedIp in configurationTools.ts misses RFC 6598 Shared Address Space (100.64.0.0/10, second octet 64-127). Confirmed false negative: isBlockedIp('100.64.0.1') returns false. Low practical risk on current Convex infra but breaks the completeness invariant set by the PR's own retro lesson on URL-fetcher threat modeling."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "packages/convex/convex/chat/configurationTools.ts isBlockedIp returns true for any IP in 100.64.0.0/10 (first octet 100, second octet 64-127 inclusive)"
  - "A unit test asserts isBlockedIp('100.64.0.1') === true and isBlockedIp('100.127.255.255') === true and isBlockedIp('100.63.0.1') === false and isBlockedIp('100.128.0.1') === false"
  - "Existing isBlockedIp coverage (RFC1918, loopback, link-local, multicast) is unchanged"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/ passes"
owner_agent: "Convex chat backend developer"
---

# isBlockedIp blocks RFC 6598 CGNAT range 100.64.0.0/10

## Context

`packages/convex/convex/chat/configurationTools.ts:95-104` defines `isBlockedIp` for IPv4:

```ts
const [a, b] = parts;
return (
  a === 10 ||
  a === 127 ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 169 && b === 254) ||
  a === 0 ||
  a >= 224
);
```

This covers RFC 1918 private space, loopback, link-local, "this network", and multicast. It does NOT cover RFC 6598 Shared Address Space (100.64.0.0/10), reserved for carrier-grade NAT (CGNAT). The security reviewer confirmed via simulation that `isBlockedIp('100.64.0.1') === false`.

While most cloud-provider metadata APIs use link-local addresses already covered (`169.254.169.254`), the completeness goal stated by the PR's own retro lesson at `workspace/lessons.md:21-26` says the threat model should be specified up front — including the full set of reserved/private ranges. CGNAT is one such range that some hosting providers do route internally.

## Goal

`isBlockedIp` rejects every IP in 100.64.0.0/10, the same way it rejects 10.0.0.0/8 and 172.16.0.0/12.

## Scope

- One-line addition to the IPv4 clause in `isBlockedIp`.
- Unit test coverage for the new branch (positive + negative boundary checks).

## Out of Scope

- IPv6 hex-mapped IPv4 bypass (covered in FG_211).
- DNS-rebind TOCTOU (covered in FG_206).
- Any change to the IPv6 branch of `isBlockedIp`.

## Approach

Extend the existing `return` expression with the CGNAT predicate:

```ts
return (
  a === 10 ||
  a === 127 ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 169 && b === 254) ||
  (a === 100 && b >= 64 && b <= 127) || // RFC 6598 CGNAT
  a === 0 ||
  a >= 224
);
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the CGNAT clause to `isBlockedIp` in `packages/convex/convex/chat/configurationTools.ts`.
2. If FG_208 (SSRF unit tests) is not yet merged, add a small in-place test alongside it; otherwise extend FG_208's test file.
3. Test the boundaries explicitly: `100.63.255.255` (just outside, should pass) and `100.128.0.0` (just outside, should pass), `100.64.0.0` and `100.127.255.255` (inside, should block).

## Constraints

- Single-line change to the IPv4 expression; do not refactor the function shape.
- Must coexist with FG_208 if both land in the same window.

## Resources

- RFC 6598: https://datatracker.ietf.org/doc/html/rfc6598
- PR #93 security review: see code review output for `ssrf-cgnat-unblocked`
- `packages/convex/convex/chat/configurationTools.ts:95-104`
