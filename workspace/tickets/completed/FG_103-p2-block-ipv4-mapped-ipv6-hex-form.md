---
id: FG_103
title: "SSRF guard rejects IPv4-mapped IPv6 in compressed-hex form"
date: 2026-05-02
type: fix
status: completed
priority: p2
description: "isBlockedIPv6 in safe-fetch.ts only matches IPv4-mapped addresses in the dotted-decimal form (::ffff:a.b.c.d). The compressed-hex form ::ffff:7f00:1 (= ::ffff:127.0.0.1) bypasses the regex. Node's dns.lookup typically returns dotted-decimal on Linux/macOS, so the gap is not realized today, but the static check should be exhaustive — a future Convex Node-runtime change or a different libc could surface the bypass."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "isBlockedIPv6 in packages/convex/convex/content/safe-fetch.ts matches both forms: dotted-decimal (::ffff:127.0.0.1) AND compressed-hex (::ffff:7f00:1)"
  - "New Vitest case: isBlockedIPv6('::ffff:7f00:1') returns true; isBlockedIPv6('::ffff:c0a8:0001') returns true (192.168.0.1); isBlockedIPv6('::ffff:8.8.8.8') returns false"
  - "Existing Vitest cases (dotted-decimal mapped, link-local, ULA, loopback) continue to pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Security / Convex backend specialist"
---

# SSRF guard rejects IPv4-mapped IPv6 in compressed-hex form

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #17, security reviewer at confidence 0.65.

`packages/convex/convex/content/safe-fetch.ts:249-256` only matches the dotted-decimal IPv4-mapped form:

```ts
const v4MappedMatch = lower.match(
  /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
);
if (v4MappedMatch) {
  const v4 = `${v4MappedMatch[1]}.${v4MappedMatch[2]}.${v4MappedMatch[3]}.${v4MappedMatch[4]}`;
  return isBlockedIPv4(v4);
}
```

The compressed-hex form `::ffff:7f00:1` represents the same address as `::ffff:127.0.0.1` but does not match this regex. Node's `dns.lookup({ all: true })` typically returns dotted-decimal on Linux/macOS — but the spec doesn't contract this, and a different runtime / libc / Convex-environment-update could surface the hex form. Failing-closed on unrecognized formats today gives us defense-in-depth.

NFR-01 explicitly takes the position that the SSRF guard is "best-effort" and not DNS-rebinding-resistant. Closing the static-form gap is consistent with the rest of the guard's threat model.

## Goal

After this ticket, both representations of every IPv4-mapped IPv6 address resolve to the same blocklist decision. An attacker-controlled DNS server returning the hex form gets blocked just like the dotted form.

## Scope

- `packages/convex/convex/content/safe-fetch.ts` `isBlockedIPv6` — add hex-form parser.
- Vitest cases in `packages/convex/convex/content/__tests__/safe-fetch.test.ts`.

## Out of Scope

- DNS rebinding resistance — explicitly out of NFR-01 scope.
- Other IPv6 form variations (e.g., embedded mixed forms with different separator placements) — only the documented IPv4-mapped variants need to match.
- Replacing the regex approach with `node:net` `isIPv4` / `isIPv6` and address normalization — could be a separate cleanup if we want to drop the regex altogether.

## Approach

After the existing `v4MappedMatch` block, add a hex-form match:

```ts
// Compressed-hex IPv4-mapped form: ::ffff:HHHH:LLLL where each pair is a
// 16-bit hex group encoding two octets of the v4 address.
const hexV4Match = lower.match(
  /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
);
if (hexV4Match) {
  const hi = Number.parseInt(hexV4Match[1]!, 16);
  const lo = Number.parseInt(hexV4Match[2]!, 16);
  const v4 = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
  return isBlockedIPv4(v4);
}
```

Alternative cleaner approach using Node's built-in: `import { isIPv4, isIPv6 } from 'node:net'` and use a normalization helper. That's a bigger refactor — recommend the targeted fix above unless we're cleaning up the regex strategy more broadly.

- **Effort:** Small
- **Risk:** Low — additive parser; existing dotted-decimal path unchanged.

## Implementation Steps

1. In `packages/convex/convex/content/safe-fetch.ts` `isBlockedIPv6`, add the hex-form match block after the dotted-decimal block.
2. Add Vitest cases asserting the new branches: `::ffff:7f00:1` (loopback) → blocked; `::ffff:c0a8:0001` (192.168.0.1) → blocked; `::ffff:0808:0808` (8.8.8.8) → NOT blocked.
3. Re-run existing safe-fetch tests to confirm no regression on dotted-decimal cases.
4. Run `pnpm --filter=@feel-good/convex test`.

## Constraints

- Failing-closed remains the policy — if either form's parsing fails, return true.
- Do not change any public API of `safe-fetch.ts`.
- The DNS-rebinding non-property is preserved (out of scope).

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #17.
- `packages/convex/convex/content/safe-fetch.ts:243-267` — `isBlockedIPv6` body.
- RFC 4291 § 2.5.5.2 — IPv4-Mapped IPv6 Address representations.
