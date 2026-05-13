---
id: FG_208
title: "Unit tests cover every SSRF guard branch in guardedFetchProfileSource"
date: 2026-05-13
type: chore
status: to-do
priority: p1
description: "guardedFetchProfileSource (configurationTools.ts) is the PR's highest-risk novel security surface but has zero unit-test coverage of any guard branch — private IP block, redirect cap, body cap, content-type allowlist, https-only, timeout, fixed user agent, no-cookies. Flipping any predicate would pass the test suite today."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "A new test file packages/convex/convex/chat/__tests__/fetchProfileSource.test.ts exists and exercises guardedFetchProfileSource directly (not just through the tool factory)"
  - "Tests cover: http:// rejected; literal-hostname loopback rejected (localhost); DNS-resolved IPv4 RFC1918 rejected; DNS-resolved IPv6 loopback ::1 rejected; redirect to non-https mid-chain rejected; >3 redirects rejected; body > 1 MB rejected; content-type image/* rejected; fetch timeout returns unavailable"
  - "The tests mock node:dns/promises.lookup and global fetch so no network egress happens during the run"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/fetchProfileSource.test.ts passes"
  - "Each test fails when its corresponding guard predicate is inverted (manual proof: temporarily flip the predicate, run the test, assert it fails)"
owner_agent: "Convex chat backend developer"
---

# Unit tests cover every SSRF guard branch in guardedFetchProfileSource

## Context

PR #93 introduced `packages/convex/convex/chat/configurationTools.ts` (new file, 427 lines) containing the LLM-callable `fetchProfileSource` tool and its `guardedFetchProfileSource` implementation. The function has nine distinct guard branches:

1. Non-https URL rejection (line 224)
2. Literal-hostname loopback/`.localhost` rejection via `isBlockedHostname` (lines 89-93)
3. DNS-resolved IPv4 RFC1918/loopback/link-local/multicast rejection via `isBlockedIp` (lines 95-104)
4. DNS-resolved IPv6 loopback/ULA/link-local/multicast/IPv4-mapped rejection (lines 106-127)
5. Per-hop https downgrade rejection (line 237)
6. Redirect cap at `PROFILE_SOURCE_MAX_REDIRECTS` = 3 (line 254)
7. Body size cap at `PROFILE_SOURCE_MAX_BYTES` = 1 MB via `readLimitedText` (lines 179-204)
8. Content-type allowlist (`text/html`, `text/plain`, `application/json`) (lines 275-286)
9. 5-second AbortController + `withDeadline` race (lines 17, 230-233, 139-156)

The test reviewer found that the entire suite contains only **two** references to `fetchProfileSource`:
- `tools.test.ts:1490` — confirms the `inputSchema` exposes only `["url"]`
- `rateLimits.test.ts:865` — confirms the tool name appears in the streaming tools list

Zero tests invoke `guardedFetchProfileSource`, `isBlockedIp`, `isBlockedHostname`, or `readLimitedText`. Inverting any guard predicate (e.g., removing the IPv6 `::ffff:` re-check) does not produce a failing test.

The PR's own retro lesson (`workspace/lessons.md:21-26`) explicitly calls out this risk class: SSRF guards need a full network threat model. Tests are how the threat model is enforced.

## Goal

Every SSRF guard branch has at least one negative test (an input that the guard should reject) and at least one positive test (an input that the guard should pass) — so flipping any predicate in `isBlockedIp`, `guardedFetchProfileSource`, or `readLimitedText` produces a failing test.

## Scope

- New file: `packages/convex/convex/chat/__tests__/fetchProfileSource.test.ts`.
- Mocks for `node:dns/promises.lookup` and global `fetch` so the suite is deterministic and offline.
- Coverage table (one test each): http:// rejection, localhost hostname rejection, IPv4 RFC1918 rejection, IPv6 loopback rejection, IPv6 `::ffff:` mapped IPv4 rejection (with both dotted and hex forms), https-downgrade-during-redirect rejection, redirect-cap rejection, body-size cap rejection, content-type rejection, abort/timeout returns unavailable.

## Out of Scope

- Fixing the DNS-rebind TOCTOU (covered in FG_206).
- Adding the CGNAT range (covered in FG_210).
- IPv6 hex-mapped IPv4 normalization fix (covered in FG_211) — but this ticket should ADD a failing test that drives FG_211's fix.
- Userinfo stripping (covered in FG_212).

## Approach

Vitest with `vi.mock("node:dns/promises", ...)` and a fetch mock attached to the global. Each test sets up a specific guard's input and asserts either `{ status: "unavailable", reason: <expected> }` or that the function throws/never reaches the fetch.

The cleanest shape is to export the internal helpers (`isBlockedIp`, `isBlockedHostname`, `guardedFetchProfileSource`) for testability. They're currently un-exported. Either export them OR test through the public `buildConfigurationTools(...).fetchProfileSource.execute(...)` boundary with a faked DNS+fetch.

- **Effort:** Medium
- **Risk:** Low

## Implementation Steps

1. Decide on export strategy: export `isBlockedIp`, `isBlockedHostname`, and `guardedFetchProfileSource` as named exports (preferred — keeps tests close to the unit), OR test through the tool boundary with mocks (preserves encapsulation).
2. Create `packages/convex/convex/chat/__tests__/fetchProfileSource.test.ts` with `vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }))` and a global `fetch` mock.
3. Write the negative tests in this order: http://, localhost hostname, 10.0.0.1 (RFC1918), 127.0.0.1, 169.254.169.254 (link-local / AWS metadata), ::1, fe80::1 (link-local IPv6), redirect to http://, 4th redirect, 2 MB body, content-type image/png, never-resolving fetch.
4. Write positive tests: https://example.com with DNS returning 93.184.216.34 returns `{ status: "available", text: "..." }`; redirect chain of 2 hops succeeds.
5. Run `pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/fetchProfileSource.test.ts` and confirm all tests pass.
6. Manually invert one predicate (e.g., remove `a === 127` from `isBlockedIp`) and confirm the corresponding test fails — this is the proof that the test actually pins the guard.

## Constraints

- No real network egress during the test run.
- Tests must run in under 5 seconds total (Vitest CI budget).
- Mocks must be reset between tests via `vi.resetAllMocks()` so test order doesn't matter.

## Resources

- PR #93: https://github.com/hpark0011/mirror/pull/93
- `packages/convex/convex/chat/configurationTools.ts:89-313` — the SSRF guard surface
- `workspace/lessons.md:21-26` — the PR's retro lesson on URL fetcher threat modeling
- Existing test patterns in `packages/convex/convex/chat/__tests__/tools.test.ts`
