---
id: PLAN_015
slug: chat-google-calendar-scheduling
title: "Chat Google Calendar scheduling"
date: 2026-05-22
type: feature
status: draft
branch: hpark0011/chat-gcal-meetings
worktree: null
scope: "Let an authenticated visitor schedule a confirmed meeting on the profile owner's connected Google Calendar through the public clone chat."
apps: [mirror]
packages: [convex]
verification_tier: 5
---
## Summary

Add Google Calendar scheduling as an owner-configured capability of the public profile clone. The profile owner connects Google Calendar in Settings, enables scheduling, and configures basic booking rules. A visitor can then ask the clone to schedule a meeting. The clone must gather an explicit date/time, check the owner's calendar for conflicts, ask for confirmation, and create the event with the authenticated visitor as an attendee.

This is a sensitive OAuth and agent-tool feature. The implementation must preserve the repo's existing agent-tool boundary: every tool scopes to the closure-bound `profileOwnerId`, no tool schema accepts any user identifier, and the server-side tool handles only data work. There is no server-side navigation requirement for v1; the chat message text can report the scheduled event link.

V1 should require authenticated visitors. Anonymous scheduling can come later after email verification and abuse controls exist.

## Current State

- Google is configured only for Better Auth sign-in in `packages/convex/convex/auth/client.ts`.
- `apps/mirror/lib/auth-client.ts` exposes the Better Auth client created by `@feel-good/features/auth`.
- Better Auth supports requesting additional Google scopes with `authClient.linkSocial({ provider: "google", scopes })`.
- Better Auth supports `getAccessToken` for provider tokens and refreshes expired access tokens when a refresh token exists.
- The installed Better Auth package has `account.encryptOAuthTokens`; local source shows legacy plaintext tokens still pass through after encryption is enabled, while newly stored tokens are encrypted.
- There is no `calendar`, `availability`, or scheduling module in Convex today.
- Clone tools are attached per stream in `packages/convex/convex/chat/actions.ts` and built in `packages/convex/convex/chat/tools.ts`.
- `buildCloneTools(profileOwnerId, { viewerId })` already has the right owner-boundary shape for write tools.
- `composeSystemPrompt` in `packages/convex/convex/chat/helpers.ts` is the only place the public clone learns the available tool vocabulary.
- Chat conversations already persist `profileOwnerId` and optional `viewerId`, so calendar tools can require `viewerId` without adding client-provided identity arguments.

## Research Anchors

- Google Calendar `events.insert` creates events at `POST /calendar/v3/calendars/{calendarId}/events`; `primary` targets the signed-in user's primary calendar, `conferenceDataVersion=1` enables Google Meet creation, and `sendUpdates=all` sends attendee notifications. Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Google Calendar `freeBusy` returns busy time ranges for calendars and supports the narrower free/busy scopes. Source: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Relevant narrow Calendar scopes are `calendar.events.owned` for events on calendars the user owns and `calendar.freebusy` / `calendar.events.freebusy` for availability. Source: https://developers.google.com/workspace/calendar/api/auth
- Google OAuth offline access requires user consent and refresh-token handling; incremental authorization is supported with additional scopes. Source: https://developers.google.com/identity/protocols/oauth2/web-server
- Better Auth documents `linkSocial` for additional Google scopes, `accessType: "offline"` plus consent prompt for refresh tokens, and `getAccessToken` for provider tokens. Sources: https://better-auth.com/docs/authentication/google and https://better-auth.com/docs/concepts/oauth

## Pre-Implementation Spikes

Do these before schema or UI work. The OAuth behavior decides the Settings UX and the token model.

1. Spike Better Auth incremental authorization on the installed version.

   - In local dev, sign in as an owner with Google.
   - Call `authClient.linkSocial({ provider: "google", scopes, callbackURL })` from a temporary Settings action.
   - Verify whether the existing Google account row gains the Calendar scopes, access token, and refresh token.
   - Verify `getAccessToken` returns a refreshed token from Convex server code.
   - Verify `https://www.googleapis.com/auth/calendar.events.owned` can insert into `primary`; if not, document the failure and switch the plan to the narrowest working Calendar event scope.
   - If the installed Better Auth behavior cannot upgrade an existing linked Google account reliably, change the Settings UX to require reconnect/sign-out/sign-in rather than pretending incremental linking works.

2. Spike token encryption prerequisites.

   - `BETTER_AUTH_SECRET` is a hard prerequisite before enabling `account.encryptOAuthTokens: true`.
   - Add `BETTER_AUTH_SECRET` validation in `packages/convex/convex/env.ts` before flipping encryption.
   - Confirm existing Google sign-in still works after encryption is enabled.
   - Accept for v1 that `encryptOAuthTokens` is forward-only: existing plaintext OAuth tokens can remain plaintext until a user reconnects. Track this as a risk rather than silently assuming old rows are encrypted.

3. Spike the Google Calendar API test seam.

   - Add a `GoogleCalendarClient` interface in `packages/convex/convex/calendar/googleApi.ts`.
   - Production actions use the fetch-backed implementation.
   - Tests inject a fake implementation through an action-level factory or module seam. Do not add production `if (testMode)` branches for e2e stubbing.

## Product Decisions

V1 scheduling policy:

- Only the profile owner can connect or configure Google Calendar.
- Scheduling is disabled by default.
- A visitor must be authenticated before the clone can schedule a meeting.
- The authenticated visitor's account email is the attendee email. The model does not get to choose a different attendee email in v1.
- Use the authenticated app user's email and display name. If the display name is missing, fall back to the email in event summaries. Do not accept model-supplied attendee identity.
- V1 allows authenticated app user emails as stored by Better Auth. Google sign-in normally provides verified emails; do not build a separate visitor email verification flow in v1.
- The clone can schedule only on the profile owner's connected calendar, defaulting to Google Calendar `primary`.
- The owner can configure timezone, default duration, minimum lead time, maximum days ahead, buffer minutes, and whether to create a Google Meet link.
- Buffer semantics: expand the requested meeting window by `bufferMinutes` on both sides for availability checks. Any overlap between the expanded window and a busy range is a conflict. Store the actual requested start/end, not the expanded buffer window.
- The visitor must provide or confirm an exact date/time before the scheduling tool runs.
- `scheduleMeeting` rechecks free/busy immediately before event creation even if `checkMeetingAvailability` already succeeded.
- The free/busy recheck reduces double-booking risk but is not atomic with `events.insert`; out-of-band calendar changes can still race between the recheck and insert.
- Duplicate tool execution is handled by server-side idempotency keyed by profile owner, viewer, conversation, start time, duration, and attendee email.

Non-v1:

- No visitor-provided arbitrary attendee email.
- No anonymous scheduling.
- No cancellation/rescheduling tool.
- No multi-attendee scheduling.
- No calendar selection UI beyond `primary`, unless listing calendars turns out to be cheap and necessary.
- No recurring events.
- No public scheduling landing page.

## Data Model

Add `packages/convex/convex/calendar/schema.ts` and register tables in `packages/convex/convex/schema.ts`.

`calendarConnections`:

- `userId: v.id("users")`
- `provider: v.literal("google")`
- `enabled: v.boolean()`
- `calendarId: v.string()`; default `"primary"`
- `timeZone: v.string()`; IANA timezone such as `"America/Los_Angeles"`
- `defaultDurationMinutes: v.number()`
- `minLeadTimeMinutes: v.number()`
- `maxDaysAhead: v.number()`
- `bufferMinutes: v.number()`
- `createGoogleMeet: v.boolean()`
- `updatedAt: v.number()`
- Indexes: `by_userId`, `by_userId_and_provider`

`scheduledMeetings`:

- `profileOwnerId: v.id("users")`
- `viewerId: v.id("users")`
- `conversationId: v.id("conversations")`
- `provider: v.literal("google")`
- `calendarId: v.string()`
- `googleEventId: v.string()`
- `htmlLink: v.optional(v.string())`
- `hangoutLink: v.optional(v.string())`
- `summary: v.string()`
- `startUtcMs: v.number()`
- `endUtcMs: v.number()`
- `timeZone: v.string()`
- `durationMinutes: v.number()`
- `attendeeEmail: v.string()`
- `idempotencyKey: v.string()`
- `createdAt: v.number()`
- `canceledAt: v.optional(v.number())`; reserved for future cancellation/rescheduling and out-of-band reconciliation
- Indexes: `by_profileOwnerId`, `by_viewerId`, `by_conversationId`, `by_idempotencyKey`

Keep arrays bounded. Do not store unbounded meeting history on `users`.

When checking idempotency, treat only non-canceled rows as active duplicates. V1 does not implement cancellation, but the field keeps future cancellation from making duplicate handling ambiguous.

## Architecture

The flow is:

 1. Owner opens Settings and clicks Connect Google Calendar.
 2. Client calls `authClient.linkSocial` with Calendar scopes and a callback back to `/@<username>/settings`.
 3. Settings queries Convex for Calendar connection status. The query checks the Better Auth Google account's stored scopes and the owner's `calendarConnections` row.
 4. Owner enables scheduling and saves Calendar preferences.
 5. Visitor chats with the public clone.
 6. The clone calls `getSchedulingConfiguration` to learn whether scheduling is enabled, what timezone to use, and what constraints apply.
 7. If the visitor is unauthenticated, the tool result tells the clone to ask them to sign in.
 8. The clone asks for any missing date/time details and confirms an absolute time.
 9. The clone calls `checkMeetingAvailability`.
10. If available and explicitly confirmed, the clone calls `scheduleMeeting`.
11. The server rechecks free/busy, creates the Google Calendar event, stores `scheduledMeetings`, and returns event details for the clone to summarize.

## OAuth And Token Handling

Files:

- `packages/convex/convex/auth/client.ts`
- `packages/convex/convex/env.ts`
- `apps/mirror/features/settings/**`
- `apps/mirror/lib/auth-client.ts`

Implementation notes:

- Add Google provider options:
  - `accessType: "offline"`
  - `prompt: "select_account consent"` unless product decides the always-consent prompt is too disruptive.
- Enable `account.encryptOAuthTokens: true` in Better Auth.
- `BETTER_AUTH_SECRET` must be present and validated in Convex env for every deployed environment before enabling token encryption. This is not optional.
- `encryptOAuthTokens` is forward-only for existing Google account rows. Settings should show reconnect when required Calendar scopes are missing; v1 accepts that preexisting plaintext OAuth tokens may remain until reconnect.
- Request Calendar scopes incrementally from Settings, not during initial sign-in:
  - `https://www.googleapis.com/auth/calendar.events.owned`
  - `https://www.googleapis.com/auth/calendar.freebusy`
- The incremental `linkSocial` behavior must be verified in the spike before committing to this UX. If Better Auth does not update an existing Google account row with the new scopes/tokens, replace the connect button with a reconnect flow that clearly signs the owner through Google consent again.
- Add a Settings connect button that calls:

```ts
await authClient.linkSocial({
  provider: "google",
  scopes: [
    "https://www.googleapis.com/auth/calendar.events.owned",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ],
  callbackURL: currentSettingsHref,
});
```

- Add server helper `getOwnerGoogleCalendarAccessToken(ctx, ownerId)` that:
  - loads the app owner row,
  - uses the Better Auth user id from `owner.authId`,
  - calls Better Auth server API `getAccessToken` for provider `google`,
  - verifies the returned scopes include the Calendar scopes,
  - returns a valid access token or a typed "needs reconnect" result.
- If Better Auth server API cannot be used cleanly from an internal Convex action, fallback to querying the Better Auth component account row and refreshing with Google's token endpoint. This fallback must stay server-only and covered by tests.
- Do not update `turbo.json` `globalEnv` unless the implementation adds a new env var read by Next or Turbo at build time. `BETTER_AUTH_SECRET` is a Convex runtime/auth env prerequisite, not automatically a Turbo build env.

## Calendar API Module

Add `packages/convex/convex/calendar/`.

Suggested files:

- `schema.ts`
- `validators.ts`
- `queries.ts`
- `mutations.ts`
- `actions.ts`
- `googleApi.ts`
- `dateTime.ts`
- `tokens.ts`

`googleApi.ts` should use REST `fetch`, not the `googleapis` package, unless a real need appears. Convex actions can use `fetch`, and direct REST keeps bundle size smaller.

`googleApi.ts` should export:

- `GoogleCalendarClient` interface with `freeBusy` and `insertEvent` methods.
- `createGoogleCalendarClient(accessToken)` production factory backed by `fetch`.
- Test fake helpers or a narrow injection seam used by Convex tests and e2e setup.

Avoid production branches keyed on a test env var. The fake should replace the client at the action boundary in tests.

Core helpers:

- `queryConnectionStatus({})`: owner-only public query for Settings. Returns connected scopes, enabled settings, and reconnect requirements.
- `upsertConnectionSettings(args)`: owner-only mutation to enable/disable scheduling and save preferences. Validate IANA timezone strings server-side at this mutation boundary.
- `internal.calendar.actions.checkAvailability`: action that calls Google free/busy.
- `internal.calendar.actions.createMeeting`: action that calls free/busy, then `events.insert`.
- `internal.calendar.mutations.recordScheduledMeeting`: mutation that writes `scheduledMeetings`.
- `internal.calendar.queries.getSchedulingContext`: internal query used by tools to read owner settings and viewer email.
- `internal.calendar.queries.findScheduledMeetingByIdempotencyKey`: duplicate guard.

Time handling:

- Add a timezone-safe helper rather than relying on server local timezone.
- Prefer adding `@js-temporal/polyfill` to `packages/convex/package.json`, used by Node actions/helpers to convert local `{ year, month, day, hour, minute, timeZone }` into UTC milliseconds and RFC3339 values.
- Reject nonexistent and ambiguous local times during DST transitions and ask the visitor to choose another time. Use distinct typed reasons so the clone can explain the issue.
- Store UTC milliseconds plus the owner's timezone.
- Send Google events with both `dateTime` and `timeZone` on `start` and `end`.
- Apply `bufferMinutes` only to conflict checks, not to the stored or created event duration.

Google event payload:

- `summary`: short meeting title, defaulting to `Meeting with <visitor name/email>`.
- `description`: include "Scheduled through Grey Mirror chat" plus the conversation id for internal traceability.
- `start`: `{ dateTime, timeZone }`
- `end`: `{ dateTime, timeZone }`
- `attendees`: one attendee with the authenticated viewer email.
- `conferenceData.createRequest`: include only when owner enabled Google Meet; use a deterministic `requestId` derived from the idempotency key and `conferenceSolutionKey.type = "hangoutsMeet"`.
- Query params: `sendUpdates=all`, `conferenceDataVersion=1` when creating Meet.

Observability:

- Add Sentry spans or structured logs around Google free/busy and event insert.
- Scrub access tokens, refresh tokens, attendee emails, and Google event payload bodies from error context. Log typed error codes, provider status codes, owner/viewer ids, and conversation id only.

## Agent Tool Design

Extend `buildCloneTools` in `packages/convex/convex/chat/tools.ts`. Add `conversationId` to `BuildCloneToolsOptions` and pass it from `streamResponse`.

`conversationId` must be required when scheduling tools are registered. If the chat stream cannot provide a conversation id, throw before exposing scheduling tools. A scheduling tool must never infer or accept a conversation id from the model.

New tools:

`getSchedulingConfiguration`

- No input args.
- Returns:
  - `enabled`
  - `connected`
  - `requiresAuthentication`
  - `timeZone`
  - `nowIso`
  - `defaultDurationMinutes`
  - `minLeadTimeMinutes`
  - `maxDaysAhead`
  - `bufferMinutes`
  - `createGoogleMeet`
- If not connected or not enabled, return a typed status rather than throwing.

`checkMeetingAvailability`

- Input:
  - `start`: `{ year, month, day, hour, minute, timeZone? }`
  - `durationMinutes?: number`
- No user identifiers.
- Uses owner timezone when `timeZone` is omitted.
- Requires scheduling enabled and connected.
- Requires authenticated viewer.
- Returns available/conflict plus normalized absolute start/end.

`scheduleMeeting`

- Input:
  - `start`: same structured local date/time object
  - `durationMinutes?: number`
  - `summary?: string`
  - `visitorNote?: string`
- No user identifiers and no arbitrary attendee email.
- Requires scheduling enabled, connected, authenticated viewer, and `conversationId`.
- Rechecks availability.
- Creates event.
- Stores idempotent meeting row.
- Returns:
  - `scheduled: true | false`
  - `reason?: "requires_authentication" | "calendar_not_connected" | "scheduling_disabled" | "time_conflict" | "outside_booking_window" | "needs_reconnect" | "ambiguous_local_time" | "nonexistent_local_time"`
  - `startIso`
  - `endIso`
  - `timeZone`
  - `summary`
  - `htmlLink?`
  - `hangoutLink?`

Tool descriptions must tell the model:

- Call `getSchedulingConfiguration` before offering scheduling.
- Ask for an exact date/time when the visitor gives relative or ambiguous wording.
- Confirm the absolute date/time before calling `scheduleMeeting`.
- Do not schedule for unauthenticated visitors; ask them to sign in.
- Never invent, request, or pass an attendee email. The server uses the authenticated visitor's account email.
- Do not claim an event is scheduled unless `scheduleMeeting.scheduled === true`.

Update `packages/convex/convex/chat/helpers.ts` scheduling vocabulary so the model knows the tools exist.

Measure prompt/token impact when adding three scheduling tools. If the tool descriptions make the base clone prompt materially larger, compress wording before implementation is considered ready.

## Settings UI

Files:

- `apps/mirror/features/settings/components/settings-panel.tsx`
- `apps/mirror/features/settings/hooks/use-profile-settings.ts`
- `apps/mirror/features/settings/lib/schemas/profile-settings.schema.ts`
- New components under `apps/mirror/features/settings/components/calendar-*`

Add a Calendar scheduling section below the default profile section control.

Connection states:

- Disconnected: no Google account or no Calendar token; show Connect Google Calendar.
- Connected but missing scopes: Google account exists but required Calendar scopes are absent; show Reconnect Google Calendar and keep scheduling disabled.
- Connected ready: Calendar scopes and owner settings are valid; allow scheduling to be enabled.

Controls:

- Connect/Reconnect Google Calendar button.
- Scheduling enabled switch.
- Timezone select/input.
- Default duration number input or select.
- Min lead time select.
- Max days ahead select.
- Buffer minutes select.
- Create Google Meet switch.

Do not show Calendar controls to non-owners. The Settings route is already owner-only; keep that invariant.

The connect button should use the existing app auth client, not a raw OAuth URL. After `linkSocial` redirects back, the query should refresh and show connected status based on stored scopes. If the spike shows `linkSocial` cannot upgrade scopes for already-linked Google accounts, this section must use the reconnect UX discovered by the spike.

## Rate Limits And Abuse Controls

Add Calendar-specific rate limits in `packages/convex/convex/chat/rateLimits.ts` or a calendar-specific rate limiter module:

- `checkMeetingAvailability`: small per-minute cap keyed by `viewerId`.
- `scheduleMeeting`: tighter per-minute cap keyed by `viewerId` and daily cap keyed by `profileOwnerId`.
- Keep a profile-owner cap so one owner cannot be flooded by many visitors.

Suggested initial limits:

- Availability checks: 10/minute per authenticated visitor, 100/day per profile owner.
- Meeting creates: 2/minute per authenticated visitor, 10/day per profile owner.

These numbers are product knobs; tests should assert the limiter is wired, not overfit exact values unless the product spec locks them.

## Implementation Steps

 1. Run the pre-implementation OAuth spikes.

    - Verify Better Auth `linkSocial` incremental Calendar scope behavior.
    - Verify `getAccessToken` refresh behavior from Convex server code.
    - Verify `calendar.events.owned` can insert into `primary`.
    - Decide Settings UX: incremental connect or explicit reconnect.

 2. Harden OAuth token handling.

    - Add `BETTER_AUTH_SECRET` env validation before enabling OAuth token encryption.
    - Enable Better Auth OAuth token encryption.
    - Add Google provider offline access options.
    - Add a server helper for scoped Google Calendar access tokens.
    - Document that old plaintext OAuth tokens remain until reconnect.

 3. Add the Google Calendar client seam.

    - Create `GoogleCalendarClient` in `calendar/googleApi.ts`.
    - Implement fetch-backed production `freeBusy` and `insertEvent` methods.
    - Add test fakes/injection helpers at the action boundary.
    - Add Sentry/logging wrappers with token/email scrubbing.

 4. Add Calendar schema and validators.

    - Create `calendarConnections` and `scheduledMeetings`.
    - Include `canceledAt` on `scheduledMeetings`.
    - Register in `schema.ts`.
    - Add generated API verification.
    - Add validators for IANA timezone, meeting duration, booking window, and buffer settings.

 5. Add Calendar Settings connection flow.

    - Add `queryConnectionStatus`.
    - Add `upsertConnectionSettings`.
    - Validate timezone server-side in `upsertConnectionSettings`.
    - Add Settings UI controls and the three connection states.
    - Use the OAuth UX selected by the spike.

 6. Add time conversion helpers.

    - Add `@js-temporal/polyfill` to `packages/convex`.
    - Implement local date/time to UTC conversion.
    - Validate booking windows, buffer expansion, and DST nonexistent/ambiguous edge cases.

 7. Add Google Calendar API actions.

    - Implement free/busy call.
    - Implement event insert with attendee and optional Google Meet.
    - Use deterministic Google Meet request ids derived from the idempotency key.
    - Normalize Google errors into typed results the agent can explain.

 8. Add meeting persistence and idempotency.

    - Compute stable idempotency key from owner, viewer, conversation, start/end, attendee email.
    - Check for existing non-canceled meeting before insert.
    - Store scheduled event metadata.

 9. Add clone tools.

    - Add required `conversationId` to `buildCloneTools` options.
    - Add `getSchedulingConfiguration`, `checkMeetingAvailability`, and `scheduleMeeting`.
    - Ensure no tool schema exposes user identifiers.
    - Ensure no tool description asks the model for an attendee email.
    - Update tool vocabulary in `chat/helpers.ts`.
    - Measure prompt/token impact and compress descriptions if needed.

10. Add tests.

    - Convex unit tests for schema/tool/token/calendar helpers.
    - Mirror component tests for Settings UI.
    - Hook tests only if chat rendering changes; no watcher changes are required for v1 unless a UI event card is added.

11. Add Playwright e2e coverage.

    - Owner connects/mocks Calendar state and enables scheduling.
    - Authenticated visitor asks for a meeting.
    - Stub Google Calendar through the `GoogleCalendarClient` test seam.
    - Assert the chat reports the scheduled time and event link.

12. Update docs and operational notes.

    - Update auth/deploy docs with new scopes and Google OAuth verification risk.
    - Add Convex env notes for Better Auth secret/token encryption.
    - Add Google Cloud Console setup notes for Calendar API and OAuth consent screen.
    - State that `turbo.json` `globalEnv` remains unchanged unless a new build-time env is introduced.

## Tests

Convex tests:

- `calendar/dateTime` converts local timezone input to UTC and rejects invalid, nonexistent, and ambiguous local times with distinct typed reasons.
- `queryConnectionStatus` returns disconnected, connected-but-missing-scopes, connected-ready-disabled, and connected-ready-enabled states.
- Token helper rejects missing scopes and handles expired token refresh through Better Auth or fallback.
- `checkMeetingAvailability` scopes to `profileOwnerId`, uses owner calendar id, and returns conflicts from free/busy.
- `checkMeetingAvailability` expands the checked window by `bufferMinutes` on both sides.
- `scheduleMeeting` rejects unauthenticated visitors.
- `scheduleMeeting` rejects disabled scheduling.
- `scheduleMeeting` rejects disconnected Calendar.
- `scheduleMeeting` rejects connected Google accounts missing required Calendar scopes.
- `scheduleMeeting` rejects outside booking window.
- `scheduleMeeting` rechecks free/busy before insert.
- `scheduleMeeting` uses deterministic Google Meet request ids derived from idempotency key.
- `scheduleMeeting` stores one meeting row and returns the existing non-canceled row on duplicate idempotency key.
- `scheduleMeeting` ignores canceled rows for duplicate detection.
- Scheduling tools are not exposed, or fail immediately, when `conversationId` is unavailable.
- Tool schema invariant tests reject `userId`, `viewerId`, `ownerId`, `profileOwnerId`, `username`, and `attendeeEmail` on the LLM-visible schemas.
- Cross-user isolation: Alice's clone cannot schedule Bob's connected calendar.
- Tool description/prompt snapshot checks confirm the model is told not to invent attendee emails and the prompt token budget remains acceptable.
- Google Calendar action tests use the `GoogleCalendarClient` fake, not production test-mode branches.

Mirror tests:

- Settings shows disconnected, connected-but-missing-scopes, and connected-ready Calendar states.
- Connect button calls `authClient.linkSocial` with Calendar scopes.
- Enabled switch and preferences save through `api.calendar.mutations.upsertConnectionSettings`.
- Unconnected state disables scheduling preferences or clearly shows reconnect.

E2E:

- Add `apps/mirror/e2e/chat-google-calendar-scheduling.authenticated.spec.ts`.
- Use Playwright CLI only.
- Required assertions:
  - Owner can enable scheduling in Settings.
  - Authenticated visitor can ask the clone to schedule a meeting for an explicit future time.
  - Stubbed free/busy conflict makes the clone report that the slot is unavailable and no event is recorded.
  - Stubbed free/busy availability plus event insert makes the clone report the scheduled time and event link.
  - A repeated response/retry does not create a duplicate `scheduledMeetings` row.
  - Missing Calendar scopes in Settings show reconnect and do not expose scheduling as enabled.

## Hard Verification

Run:

```bash
pnpm --filter=@feel-good/convex run verify:codegen
pnpm build --filter=@feel-good/mirror
pnpm lint --filter=@feel-good/mirror
pnpm --filter=@feel-good/convex test
pnpm --filter=@feel-good/mirror test:unit
pnpm --filter=@feel-good/mirror exec playwright test e2e/chat-google-calendar-scheduling.authenticated.spec.ts
```

Manual supporting smoke check:

```bash
pnpm dev --filter=@feel-good/mirror
```

Open the owner Settings page, connect/reconnect Google Calendar in a dev Google account, enable scheduling, then ask the public clone to schedule a meeting. Confirm the Google Calendar event appears with the visitor attendee, notification, and Meet link when enabled.

## Constraints And Non-Goals

Constraints:

- Do not accept owner/user identifiers in any LLM-visible tool schema.
- Do not store Google tokens in app tables unless they are encrypted.
- Do not enable Better Auth OAuth token encryption until `BETTER_AUTH_SECRET` is validated in Convex env.
- Do not request broad Calendar scopes unless the narrower scopes cannot support the feature.
- Do not let anonymous visitors schedule meetings in v1.
- Do not trust model-supplied attendee email in v1.
- Do not claim scheduling success unless Google event creation succeeded or an existing idempotent meeting row is found.
- Do not add production `testMode` branches for Google Calendar e2e stubbing; use the client seam.
- Do not update `turbo.json` `globalEnv` unless a new env var is read by Next or Turbo at build time.
- Do not use fixed waits in Playwright tests.
- Do not use Playwright MCP or browser automation MCP for test assertions.

Non-goals:

- No cancellation or rescheduling.
- No recurring events.
- No team calendars or room/resource booking.
- No calendar availability UI outside chat.
- No owner working-hours editor in v1 unless product decides it is mandatory before launch.
- No Google Workspace domain-wide delegation.

## Risks And Follow-Ups

- Google Calendar scopes can trigger OAuth verification work for production. Start that process before launch, not after implementation.
- Better Auth incremental `linkSocial` behavior may not upgrade existing Google accounts on this installed version. Spike before building Settings UI.
- `calendar.events.owned` may not be sufficient for inserting into `primary` in every relevant Google account shape. Verify during the OAuth/API spike before broadening scopes.
- Enabling token encryption touches auth behavior. Test existing Google sign-in and account linking before shipping.
- OAuth token encryption is forward-only for existing account rows; old plaintext tokens can remain until users reconnect unless a separate invalidation/migration is designed.
- `freeBusy` followed by `events.insert` is not atomic. The implementation can reduce but not eliminate double-booking races with out-of-band Calendar changes.
- Timezone parsing is the highest correctness risk. Keep the tool schema structured and server conversion authoritative.
- The LLM may still try to schedule from ambiguous language. The prompt and tests must require confirmation of an absolute date/time before `scheduleMeeting`.
- Three additional clone tools can increase prompt size and latency. Measure token impact before shipping.
- The Google Calendar client seam must be designed early; retrofitting testability after direct `fetch` calls in actions will make e2e stubbing brittle.
- If product later wants anonymous scheduling, create a separate plan for verified email capture, spam controls, and unsubscribe/cancellation flows.