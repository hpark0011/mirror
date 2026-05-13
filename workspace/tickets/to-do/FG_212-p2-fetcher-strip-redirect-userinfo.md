---
id: FG_212
title: "guardedFetchProfileSource strips userinfo from initial URL and redirect Location"
date: 2026-05-13
type: fix
status: to-do
priority: p2
description: "new URL(location, current) in the redirect loop preserves any user:password@ injected by an attacker-controlled intermediate hop. fetch then transmits HTTP Basic Authorization to the next target. The initial owner-supplied URL is similarly accepted with credentials because Zod .url() does not reject userinfo. Strip credentials before every fetch."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "guardedFetchProfileSource clears url.username and url.password before every fetch call (initial URL and after each redirect Location)"
  - "A unit test asserts that fetching https://user:secret@example.com/path does not include an Authorization header in the outbound request"
  - "A unit test asserts that a redirect with Location: https://attacker:token@target.com/x results in a follow-up fetch with no Authorization header"
  - "pnpm --filter=@feel-good/convex exec vitest run convex/chat/__tests__/ passes"
owner_agent: "Convex chat backend developer"
---

# guardedFetchProfileSource strips userinfo from initial URL and redirect Location

## Context

`packages/convex/convex/chat/configurationTools.ts:222-261`:

```ts
let current = new URL(url);
// ...redirect loop:
const location = response.headers.get("location");
if (!location) { throw ... }
current = new URL(location, current);
continue;
```

`new URL("https://user:pass@target.com", current)` preserves the embedded `user:pass` into `current.username` and `current.password`. The next iteration calls `fetch(current.toString(), ...)` and the WHATWG fetch spec specifies that userinfo in the URL produces an `Authorization: Basic <base64>` header on the outgoing request.

The Zod input validator at `inputSchema: z.object({ url: z.string().url() ... })` accepts credential-bearing URLs (confirmed: `z.string().url().parse('https://user:pass@example.com')` succeeds).

Risk surface:
- An attacker who controls one hop in a multi-hop redirect chain (e.g., a URL shortener) can inject credentials into the subsequent hop.
- An owner who pastes a credential-bearing URL would have those credentials transmitted to the target.
- Either way: the Convex Node runtime appears to make authenticated requests on behalf of unknown parties, enabling account probing, audit-log pollution, or rate-limit bypass on third-party services.

The hostname check is unaffected because `current.hostname` extracts the bare hostname. The fix is to strip credentials before each `fetch`.

## Goal

The fetcher never emits `Authorization` from URL-embedded credentials. Userinfo is dropped from the initial URL and after every redirect.

## Scope

- `packages/convex/convex/chat/configurationTools.ts` — strip credentials at line 223 (after initial `new URL(url)`) and inside the redirect loop after `current = new URL(location, current)`.
- Unit tests covering both vectors.

## Out of Scope

- Rejecting URLs containing userinfo at the Zod-input layer — a stricter UX choice; out of scope for this defensive fix. Could be a follow-up if product wants explicit rejection.
- DNS rebind fix (FG_206), CGNAT (FG_210), IPv6 hex (FG_211) — independent SSRF tickets.

## Approach

Add a one-line strip after every URL construction:

```ts
function stripUrlUserinfo(url: URL): URL {
  url.username = "";
  url.password = "";
  return url;
}

// Initial URL
let current = stripUrlUserinfo(new URL(url));

// After redirect
current = stripUrlUserinfo(new URL(location, current));
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add a small `stripUrlUserinfo(url: URL)` helper inside `configurationTools.ts` (or inline the two assignments).
2. Apply it right after `new URL(url)` (line 223) and right after `new URL(location, current)` (line 261).
3. Add a unit test that intercepts the `fetch` call (via global mock) and asserts the outgoing URL string does not contain `@` between scheme and host, and that no `Authorization` header was set.
4. Add a second unit test that returns a 302 with `Location: https://user:pass@example.com/...` and asserts the follow-up fetch is similarly clean.
5. Run the test suite.

## Constraints

- Must not change the IP/hostname check behavior — `current.hostname` already ignores userinfo and continues to work.
- Must not alter the existing redirect cap, body cap, content-type allowlist, or timeout logic.

## Resources

- WHATWG Fetch §5.2 (URL credentials → Authorization): https://fetch.spec.whatwg.org/
- PR #93 security review: `redirect-credential-injection`
- `packages/convex/convex/chat/configurationTools.ts:222-261`
