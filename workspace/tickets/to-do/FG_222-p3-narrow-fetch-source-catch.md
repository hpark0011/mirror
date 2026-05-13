---
id: FG_222
title: "guardedFetchProfileSource catch narrows to expected fetch failures only"
date: 2026-05-13
type: fix
status: to-do
priority: p3
description: "The outer catch in guardedFetchProfileSource silently converts every thrown error — including future programming bugs (TypeError, null deref, unexpected response shape) — to a status: unavailable response. Programming bugs are masked as graceful 'unavailable' results the LLM sees, with no signal to logs or on-call."
dependencies:
  - FG_213
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "The catch in guardedFetchProfileSource distinguishes 'expected fetch failure' (timeout, SSRF block, content-type rejection, redirect cap, body cap, non-https, HTTP error, network error) from 'unexpected programming error' (TypeError, null deref, etc.)"
  - "Expected failures continue to return { status: 'unavailable', reason } as today"
  - "Unexpected failures are re-thrown (or logged and re-thrown) so on-call sees them in Convex logs / Sentry rather than the LLM swallowing them"
  - "A unit test asserts a deliberate TypeError thrown inside the fetch loop propagates to the caller (or is logged), not returned as unavailable"
owner_agent: "Convex chat backend developer"
---

# guardedFetchProfileSource catch narrows to expected fetch failures only

## Context

`packages/convex/convex/chat/configurationTools.ts:297-310` (after FG safe-fix patches that normalize abort message and remove dead-code fallthrough):

```ts
} catch (error) {
  const isAbort = error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message));
  const reason = isAbort
    ? "Profile source fetch timed out"
    : error instanceof Error ? error.message : String(error);
  return {
    status: "unavailable" as const,
    reason,
    finalUrl: current.toString(),
    detectedKind: detectContactKind(current.toString()),
  };
}
```

The correctness reviewer flagged that this catch is structurally too broad. The function throws several KNOWN errors inside the try (intentional, for control flow): `"Only https:// URLs can be fetched"`, `"Host is not publicly fetchable"`, `"Host resolves to a blocked network address"`, `"Profile source fetch timed out"`, `"Too many redirects"`, `"Redirect missing location"`, `"Unsupported content type"`, `"Response body is too large"`, `"Redirected to a non-HTTPS URL"`, plus network errors from `fetch()`.

But the catch also captures UNEXPECTED programming errors — a future TypeError from an unexpected response shape, a null deref in a refactor of `readLimitedText`, etc. Today there is no such bug; the risk is future regression silently degrading the tool to "always unavailable."

This pairs with FG_213 (observability): logging the failure category at the catch makes the narrowing easier (the category enum is the same set of expected errors).

## Goal

Programming errors inside `guardedFetchProfileSource` surface to logs / Sentry rather than being silently converted to an LLM-visible "unavailable" response.

## Scope

- `packages/convex/convex/chat/configurationTools.ts` — narrow the catch, or wrap each `throw new Error(...)` site in a tagged-error pattern so the catch can distinguish expected vs unexpected.
- One unit test that proves the narrowing works.

## Out of Scope

- Adding the observability log itself (covered in FG_213).
- Changing the existing `unavailable` response shape for legitimate failure paths.

## Approach

Two viable shapes:

1. **Allowlist of expected messages.** Keep a constant array of expected error message strings; if `error.message` matches, return `unavailable`; otherwise rethrow (or log + rethrow). Simple but brittle to message-text drift.

2. **Tag expected errors with a class or symbol.** Define a small `FetchSourceError extends Error` class with a `category: FailureCategory` field. Replace `throw new Error(...)` sites with `throw new FetchSourceError("...", "blocked_ip")`. The catch checks `instanceof FetchSourceError` and uses `error.category` directly; anything else is rethrown.

Approach 2 is cleaner and integrates naturally with FG_213's `failureCategory` log field.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Define `class FetchSourceError extends Error { constructor(message: string, public readonly category: FailureCategory) { super(message); } }` at the top of `configurationTools.ts`.
2. Replace each `throw new Error("...")` site in `guardedFetchProfileSource`, `assertPublicHostnameBeforeDeadline`, `readLimitedText`, and `withDeadline` with `throw new FetchSourceError("...", "<category>")`.
3. Update the catch to: if `error instanceof FetchSourceError`, return unavailable with the category in the reason (or log + return); else, rethrow.
4. Add a unit test that monkey-patches an internal function to throw a TypeError mid-flow and asserts the call rejects with a TypeError (not returns `{ status: "unavailable" }`).
5. Confirm existing tests still pass.

## Constraints

- Must not change the `unavailable` reason strings for legitimate failures (the LLM is prompt-tuned to handle specific reason strings).
- Must not break the rate-limit error path (`enforceFetchLimit` throws a regular Error today; those happen BEFORE `guardedFetchProfileSource` runs, so unaffected).

## Resources

- PR #93 correctness review: `fetch-catch-swallows-unsupported-content-type`
- `packages/convex/convex/chat/configurationTools.ts:222-313`
- FG_213 (observability) — natural pair
