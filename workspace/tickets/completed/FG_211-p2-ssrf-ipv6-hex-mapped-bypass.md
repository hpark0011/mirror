---
id: FG_211
title: "isBlockedIp rejects hex-form IPv4-mapped IPv6 (::ffff:7f00:0001)"
date: 2026-05-13
type: fix
status: completed
priority: p2
description: "The ::ffff: handler in isBlockedIp only catches dotted-decimal IPv4-mapped IPv6 (::ffff:127.0.0.1). The hex-group form ::ffff:7f00:0001 (also equivalent to 127.0.0.1) falls through both the IPv4 branch (isIP returns 0 for '7f00:0001') and the IPv6 branch (the prefix doesn't match any blocked literal). Confirmed false negative."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "isBlockedIp('::ffff:7f00:0001') returns true (equivalent to 127.0.0.1)"
  - "isBlockedIp('::ffff:a00:1') returns true (equivalent to 10.0.0.1)"
  - "isBlockedIp('::ffff:5db8:d822') returns false (equivalent to 93.184.216.34, a public IP)"
  - "isBlockedIp('::ffff:127.0.0.1') and isBlockedIp('::ffff:10.0.0.1') continue to return true (no regression)"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/ passes"
owner_agent: "Convex chat backend developer"
---

# isBlockedIp rejects hex-form IPv4-mapped IPv6 (::ffff:7f00:0001)

## Context

`packages/convex/convex/chat/configurationTools.ts:107-128` handles IPv6:

```ts
if (family === 6) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return isBlockedIp(mapped);
    }
  }
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    /* ... */
  );
}
```

The `::ffff:` block unwraps the IPv4-mapped IPv6 form ONLY when the suffix parses as IPv4 dotted-decimal. RFC 4291 also permits the hex-group form `::ffff:7f00:0001` for 127.0.0.1: two 16-bit hex groups. `isIP('7f00:0001')` returns `0` because it's not a valid standalone IPv4 or IPv6 representation, so the inner check is skipped. The outer IPv6 fallback does not match `::ffff:7f00:...` either.

The security reviewer confirmed via Node simulation:
```
isBlockedIp('::ffff:7f00:0001') === false  // should be true (127.0.0.1)
isBlockedIp('::ffff:a00:1')     === false  // should be true (10.0.0.1)
```

Risk: a DNS server (attacker-controlled record OR DNS rebinding TOCTOU window from FG_206) can return a AAAA record in this form. The OS resolver normalizes it on connect, so `fetch()` ends up at 127.0.0.1.

## Goal

`isBlockedIp` normalizes any IPv4-mapped IPv6 representation (dotted-decimal AND hex-group) to its IPv4 form before applying the IPv4 blocklist.

## Scope

- `packages/convex/convex/chat/configurationTools.ts:107-128` — extend the `::ffff:` branch.
- Unit tests covering both forms.

## Out of Scope

- Switching to a third-party IP normalization library (e.g., `ip-address`, `netmask`) — out of scope for this single-issue fix. Note: if multiple IPv6 normalization issues accumulate, consider a follow-up to adopt a library.
- IPv6-embedded IPv4 in other RFC 4291 forms beyond `::ffff:` (e.g., `64:ff9b::/96` NAT64).

## Approach

After slicing the `::ffff:` prefix, check whether the suffix matches two hex groups and convert to dotted decimal:

```ts
if (normalized.startsWith("::ffff:")) {
  const mapped = normalized.slice("::ffff:".length);
  // RFC 4291 dotted-decimal form
  if (isIP(mapped) === 4) {
    return isBlockedIp(mapped);
  }
  // RFC 4291 hex-group form: "hhhh:hhhh"
  const hexGroups = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexGroups) {
    const high = parseInt(hexGroups[1], 16);
    const low = parseInt(hexGroups[2], 16);
    const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    if (isIP(dotted) === 4) {
      return isBlockedIp(dotted);
    }
  }
}
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add the hex-group normalization branch inside the `::ffff:` block in `isBlockedIp`.
2. Add unit tests in either FG_208's new file or alongside it: hex 7f00:0001 → blocked, hex a00:1 → blocked, hex 5db8:d822 (93.184.216.34) → not blocked. Also keep coverage on dotted ::ffff:127.0.0.1 to confirm no regression.
3. Run the test suite.

## Constraints

- Pure addition — must not change the dotted-decimal path or the non-mapped IPv6 fallback.
- Must keep `isBlockedIp` synchronous and exception-free for malformed input (just return `true` for unrecognized, which is the existing pattern at line 128).

## Resources

- RFC 4291 §2.5.5.2 (IPv4-Mapped IPv6 Address): https://datatracker.ietf.org/doc/html/rfc4291#section-2.5.5.2
- PR #93 security review: `ssrf-ipv6-hex-mapped-bypass`
- `packages/convex/convex/chat/configurationTools.ts:107-128`
