---
id: FG_022
title: "Auth edge cases surface warnings via Convex logs"
date: 2026-02-24
type: improvement
status: completed
priority: p2
description: "Add console.warn/info instrumentation to Convex user queries so that auth edge cases (authenticated session but no app user record) emit structured warnings in Convex's log dashboard. Sentry SDK cannot run in Convex's V8 runtime (queries/mutations) — uses native console logging instead."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "getCurrentProfile logs a console.warn when safeGetAuthUser returns a user but no app user record exists in the users table"
  - "ensureProfile logs a console.info when it backfills a user record, including the authId"
  - "grep -r 'console.warn' packages/convex/convex/users.ts returns at least one match containing '[auth]'"
  - "grep -r 'console.info' packages/convex/convex/users.ts returns at least one match containing '[auth]'"
  - "pnpm exec convex codegen --typecheck disable passes after changes"
owner_agent: "Sentry Instrumentation Specialist"
---

# Auth edge cases surface warnings via Sentry logs

## Context

During debugging of the onboarding flow (2026-02-24), `getCurrentProfile` returned `null` for an authenticated user because the app user record didn't exist in the `users` table. This failure was silent — no errors in the browser console, no Sentry alerts, nothing in Convex logs. The only signal was a forever-spinning loading screen.

The `ensureProfile` mutation was added as a backfill mechanism, but without instrumentation we have no visibility into how often this codepath fires in production. If more users hit this state, we'd only learn about it from support tickets.

Relevant code: `packages/convex/convex/users.ts:42-71` (`getCurrentProfile`) and `packages/convex/convex/users.ts:220-248` (`ensureProfile`).

## Goal

Auth edge cases in Convex user functions emit structured Sentry log warnings, giving the team visibility into data migration gaps and auth misconfigurations without waiting for user reports.

## Scope

- Add Sentry logger calls to `getCurrentProfile` for the "auth user exists but no app user" case
- Add Sentry logger call to `ensureProfile` when it creates a backfill record
- Use `logger.warn` for unexpected states, `logger.info` for successful backfills

## Out of Scope

- Adding Sentry to other Convex functions (mutations already throw on auth failure — those are captured by default error handling)
- Setting up Sentry alerts or dashboards (separate ops task)
- Adding Sentry to the client-side onboarding wizard

## Approach

Import Sentry in `users.ts` and use the structured logger (`Sentry.logger`) as documented in the Sentry Next.js rules (`.claude/rules/sentry/next-js.md`). Convex functions run server-side, so use `@sentry/node` or the existing Sentry server config. Add `logger.warn` at the specific decision points where the function detects an unexpected auth state.

- **Effort:** Small
- **Risk:** Low

## Implementation Steps

1. Verify Sentry server SDK is available in the Convex package (`grep` for `@sentry` in `packages/convex/package.json`); add if missing
2. Import Sentry at top of `packages/convex/convex/users.ts`
3. In `getCurrentProfile`, after the `safeGetAuthUser` check passes but `appUser` query returns null, add `logger.warn` with `authId` attribute
4. In `ensureProfile`, after successfully inserting a new user record, add `logger.info` with `authId` and `email` attributes
5. Run `pnpm exec convex codegen --typecheck disable` to verify compilation
6. Verify logs appear by checking Convex dev server output when hitting the onboarding page

## Constraints

- Use `logger.fmt` for template literals per Sentry rules
- Do not add Sentry spans/tracing — this ticket is logger-only
- Do not log PII beyond email (no session tokens, no IP addresses)
- Must not change function behavior — logging is additive only

## Resources

- Sentry logging rules: `.claude/rules/sentry/next-js.md`
- Convex users module: `packages/convex/convex/users.ts`
- Sentry server config: `apps/mirror/sentry.server.config.ts`
- Lessons learned: `workspace/lessons.md` (2026-02-24 entry)
