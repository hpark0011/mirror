---
id: FG_213
title: "fetchProfileSource emits structured logs and Sentry breadcrumbs"
date: 2026-05-13
type: improvement
status: completed
priority: p2
description: "guardedFetchProfileSource is a brand-new external I/O boundary with no instrumentation. The try/catch silently converts every failure to status: unavailable with no log or Sentry trace. A misconfigured blocklist that false-positives or false-negatives is invisible until a user files a support ticket."
dependencies: []
parent_plan_id: workspace/plans/2026-05-13-profile-configuration-helper-agent-plan.md
acceptance_criteria:
  - "guardedFetchProfileSource emits a structured log at entry (with URL host) and exit (with final status, HTTP code, latency ms) using the project's existing console.log or Sentry instrumentation"
  - "Every SSRF-block path (hostname blocked, IP blocked, content-type rejected, body cap hit) logs the specific block reason"
  - "Logs do NOT include the full URL path or query string (avoid PII leakage); only the host and status"
  - "An on-call engineer can query the Convex dashboard or Sentry by 'fetchProfileSource' to see the failure rate"
owner_agent: "Convex chat backend developer"
---

# fetchProfileSource emits structured logs and Sentry breadcrumbs

## Context

`packages/convex/convex/chat/configurationTools.ts:222-313` wraps the entire fetch flow in a single try/catch that converts every failure to `{ status: "unavailable", reason }`. There is:

- No `console.log` at entry or exit
- No Sentry breadcrumb
- No metric on success/failure rate
- No record of WHICH guard branch fired

The reliability reviewer flagged this in code review at confidence 0.88: "If the tool consistently returns unavailable due to a misconfigured SSRF blocklist (e.g., a false positive in isBlockedIp for a valid CDN IP), every owner who tries to import their LinkedIn URL gets a silent failure and a confusing LLM response. On-call has no metric to confirm the failure rate, no URL to investigate, and no way to distinguish 'URL was genuinely unreachable' from 'our blocklist is too aggressive'. The first signal will be a support ticket."

## Goal

Every invocation of `guardedFetchProfileSource` leaves a structured trace describing the host, final outcome, latency, and (on failure) which guard branch fired. An on-call engineer can answer "what's the false-positive rate on the SSRF blocklist?" with a single dashboard query.

## Scope

- `packages/convex/convex/chat/configurationTools.ts`:
  - Log entry: hostname, hop count = 0, deadline timestamp.
  - Log success: hostname, HTTP status, content-type, body size, latency.
  - Log failure: hostname, failure category (e.g., `blocked_hostname`, `blocked_ip`, `content_type`, `redirect_cap`, `body_size`, `timeout`, `non_https_redirect`, `http_error`, `unknown`), latency.
- Optional: Sentry breadcrumb integration if `@feel-good/sentry-config` exposes a Convex-compatible client (verify).

## Out of Scope

- Building a new dashboard (operator concern — once logs exist, dashboards are a separate ticket).
- Logging the full request/response body (PII risk + log-volume).
- Logging the URL path or query string (PII risk).

## Approach

Use the same `console.log` / `console.warn` pattern Convex actions already use; if `@feel-good/sentry-config` provides a Convex-compatible client, also add a Sentry breadcrumb.

Add a `failureCategory` enum and use it in the structured log:

```ts
type FailureCategory =
  | "blocked_hostname"
  | "blocked_ip"
  | "non_https"
  | "non_https_redirect"
  | "redirect_cap"
  | "redirect_missing_location"
  | "body_size"
  | "content_type"
  | "http_error"
  | "timeout"
  | "unknown";

console.log("fetchProfileSource", {
  hostname: current.hostname,
  status,
  failureCategory,
  latencyMs,
  httpStatus,
  contentType,
});
```

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Add a `failureCategory` discriminant inside the catch (map known error messages to categories; default to `unknown`).
2. Record start time at entry; compute latency at every return point.
3. Emit one log line at entry and one at exit (success or failure path).
4. Verify the log shape against the project's existing structured-log convention (grep for `console.log({` in other Convex actions).
5. If `@feel-good/sentry-config` supports the Convex Node runtime, add a `Sentry.addBreadcrumb` call on failure paths.
6. Manual smoke test via `convex dev` and the chat configuration flow — confirm log lines appear in the Convex dashboard.

## Constraints

- Must not log the full URL path or query string.
- Must not log the response body.
- Must not log the User-Agent or any request header values.

## Resources

- PR #93 reliability review: `fetch-source-no-observability`
- `packages/convex/convex/chat/configurationTools.ts:222-313`
- `.claude/rules/sentry/` — existing Sentry instrumentation patterns
