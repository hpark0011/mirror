---
id: FG_206
title: "Close DNS-rebind SSRF window in fetchProfileSource"
date: 2026-05-13
type: fix
status: completed
priority: p1
description: "The configuration agent's fetchProfileSource tool validates the resolved IP via node:dns/promises.lookup() and then calls fetch(current.toString()), which re-resolves the hostname independently. A short-TTL attacker DNS record can return a public IP for the safety check and a private/loopback/metadata IP for the actual fetch."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "grep -n 'lookup(hostname' packages/convex/convex/chat/configurationTools.ts returns no occurrence where the resolved IP is discarded before fetch — the validated IP must be the IP fetch connects to"
  - "A new unit test under packages/convex/convex/chat/__tests__/ asserts that when DNS returns a public IP on the first lookup and a private IP on the second, the fetch does NOT connect to the private IP (or is rejected)"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/ passes"
  - "Three reviewers (security, concurrency, codex PR thread r3232601682) agree the rebinding window is closed"
owner_agent: "Convex chat backend developer"
---

# Close DNS-rebind SSRF window in fetchProfileSource

## Context

PR #93 introduced `guardedFetchProfileSource` at `packages/convex/convex/chat/configurationTools.ts:222-313` for the new configuration chat mode. The tool lets the profile owner pass an HTTPS URL whose text the LLM ingests. The current SSRF defense calls `assertPublicHostnameBeforeDeadline` (lines 159-177) which resolves the hostname via `node:dns/promises.lookup({ all: true, verbatim: true })` and validates every returned IP against `isBlockedIp`. The function then returns and the caller immediately runs `await fetch(current.toString(), ...)` at line 243 — which uses the OS resolver to look up the same hostname AGAIN. A DNS record with TTL 0/1 (or a CNAME pointing at a dynamic record) can serve a public IP for the first lookup and 127.0.0.1 / 169.254.169.254 / 10.x for the second.

Three independent reviewers flagged this in code review:
- `security` agent — confidence 0.85, P1
- `concurrency` agent — confidence 0.92, P1
- `chatgpt-codex-connector[bot]` on the PR — thread `r3232601682`, unaddressed in the current commit

The PR's own retro lesson in `workspace/lessons.md:21-26` calls out this exact failure mode: "Any URL-fetching tool exposed to an agent should specify DNS/IP blocklists, redirect re-resolution, redirect/body/time/content-type caps, no ambient credentials, a fixed user agent, and per-conversation rate limits before implementation starts. 'SSRF guards' is too vague."

## Goal

The IP that `assertPublicHostnameBeforeDeadline` validates is the IP that `fetch` connects to — there is no second DNS resolution between the check and the connection. A DNS record that flips between public and private IPs cannot reach private services.

## Scope

- `packages/convex/convex/chat/configurationTools.ts`:
  - `assertPublicHostnameBeforeDeadline` returns the validated IP (or set) so the caller can pin the connection.
  - `guardedFetchProfileSource` connects to the validated IP and sets the original hostname via the `Host` header, OR uses an Undici dispatcher with a fixed `connect` IP, OR documents and relies on a Convex-infra egress allowlist.
- Re-application of the same pin on every redirect hop.
- New unit test that fakes the DNS layer to return different IPs across calls and asserts the connection does not reach a private IP.

## Out of Scope

- Changing the IP blocklist contents (covered in FG_210 CGNAT, FG_211 IPv6 hex-mapped, FG_212 redirect-userinfo).
- Replacing the per-conversation/per-owner rate limits.
- Adding observability for the fetcher (covered in FG_213).

## Approach

Two viable approaches:

1. **Pin the connection to the validated IP using Undici.** Construct an `undici.Agent` with a `connect` override that resolves to the IP already validated by `assertPublicHostnameBeforeDeadline`. Pass the original hostname as the Host header so TLS SNI and certificate validation still work. This works inside the Convex Node runtime (`"use node"`).

2. **Resolve once, connect by IP, set Host header.** Rewrite the request URL to use the validated IP as the host and set `headers: { Host: originalHostname }`. Trade-off: many TLS stacks reject this because SNI no longer matches the certificate CN.

Approach 1 is the standard fix for SSRF-via-DNS-rebind in Node. Approach 2 is simpler but more fragile.

- **Effort:** Medium
- **Risk:** Medium

## Implementation Steps

1. Refactor `assertPublicHostnameBeforeDeadline` to return the first validated `LookupAddress` (family + address) rather than `void`.
2. Replace the bare `fetch(current.toString(), ...)` call with an Undici dispatcher whose `connect` callback is fixed to the validated IP for the request's host. The fetcher MUST re-validate on every redirect hop — re-resolve, re-pin.
3. Add a unit test at `packages/convex/convex/chat/__tests__/fetchProfileSource.test.ts` that mocks `node:dns/promises.lookup` to return `[{ address: '93.184.216.34', family: 4 }]` on the first call and `[{ address: '169.254.169.254', family: 4 }]` on the second; assert the fetcher either still connects to 93.184.216.34 OR rejects with "Host resolves to a blocked network address".
4. Re-run the existing tools.test.ts suite to confirm no regression.
5. Manually verify against a test domain with a short TTL (or use the unit test as the canonical proof).

## Constraints

- Must not loosen the existing IP blocklist; this ticket strictly tightens the trust boundary.
- The owner-only auth check (`assertOwner()`) and rate-limit checks at the tool boundary remain unchanged.
- Keep the `unavailable` response shape for blocked/private targets so the LLM's recovery path is unchanged.

## Resources

- PR #93: https://github.com/hpark0011/mirror/pull/93
- Codex PR thread: https://github.com/hpark0011/mirror/pull/93#discussion_r3232601682
- `.claude/rules/embeddings.md` (cross-user isolation invariant)
- `workspace/lessons.md:21-26` — the PR's own retro lesson on this risk class
