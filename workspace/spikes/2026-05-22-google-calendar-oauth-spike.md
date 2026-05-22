---
id: SPIKE_001
slug: google-calendar-oauth
title: "Google Calendar OAuth spike runbook"
date: 2026-05-22
plan: PLAN_015
branch: hpark0011/chat-gcal-meetings
status: ready
---

# Google Calendar OAuth spike

Gates PLAN_015. The Settings UX, token-resolution helper, and clone-tool
behavior all depend on the answers below. **Do not implement clone tools
or Calendar `events.insert` actions until every step here has a recorded
result.**

## What this spike is for

The plan makes assumptions about Better Auth + Google's OAuth surface
that need live verification before more code lands:

1. Does `authClient.linkSocial({ provider: "google", scopes, ... })`
   **upgrade** an existing linked Google account with the two new
   Calendar scopes, or does it require a sign-out / reconnect flow?
2. From inside a Convex action, can we resolve a valid Google access
   token (and have it refresh automatically when expired)?
3. Does the narrow `calendar.events.owned` scope actually let us
   `POST /calendar/v3/calendars/primary/events`, or do we need a
   broader scope?
4. Can we flip `account.encryptOAuthTokens: true` without breaking
   existing Google sign-in flows?

The token-status seam already exists at
`packages/convex/convex/calendar/tokens.ts` and treats refresh as a
TODO. The answers below fill that TODO in.

## Prerequisites

Run all of these from a provisioned worktree (this branch is fine).

```bash
# 1) Confirm BETTER_AUTH_SECRET is set on the dev Convex deployment.
#    The Convex env validation now requires it (length >= 32).
#    The worktree's .env.local should not contain it — secrets live in
#    Convex env, not in app .env.local. To check:
cd packages/convex
npx convex env list | grep BETTER_AUTH_SECRET

# 2) If absent, generate and set:
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
npx convex env set BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET"

# 3) Confirm the Google Cloud Console project for dev has Calendar API
#    enabled and the OAuth consent screen lists the two scopes you want
#    to request (add them under "Scopes" → "Add or Remove Scopes"):
#      - https://www.googleapis.com/auth/calendar.events.owned
#      - https://www.googleapis.com/auth/calendar.freebusy
#    Without this, `linkSocial` will be rejected with `invalid_scope`.

# 4) Start the app (terminal A) and Convex dev (terminal B):
pnpm dev --filter=@feel-good/mirror
pnpm --filter=@feel-good/convex run dev
```

## Step 1 — incremental `linkSocial` behavior

**Goal:** decide whether Settings UX uses an "Add Calendar permission"
button (incremental upgrade) or a "Reconnect Google Calendar" button
(sign-out → sign-in with broader consent).

### 1.a — Sign in with the existing narrow scopes

1. Open `http://localhost:3001/sign-in` in an Incognito window.
2. Sign in with a dev Google account that is on the beta allowlist.
3. Confirm you reach `/@<username>/posts` (or `/onboarding` for a new
   account — finish onboarding if so).

### 1.b — Inspect the current account row

In a third terminal:

```bash
cd packages/convex
npx convex run --no-push 'betterAuth/adapter:findOne' '{
  "model": "account",
  "where": [
    { "field": "providerId", "value": "google" },
    { "field": "userId", "value": "<auth-user-id>" }
  ]
}'
```

To find `<auth-user-id>`:

```bash
npx convex run --no-push 'betterAuth/adapter:findOne' '{
  "model": "user",
  "where": [{ "field": "email", "value": "<your-google-email>" }]
}'
# copy the `_id` field — that's the authId
```

**Record:**
- [ ] `scope` field value (before linkSocial):
- [ ] `accessToken` present (yes/no):
- [ ] `refreshToken` present (yes/no):
- [ ] `accessTokenExpiresAt`:

### 1.c — Call `linkSocial` with the Calendar scopes

There is no Settings UI yet. Drive it from the browser console on
`/@<username>/settings`:

```js
const { authClient } = await import("/_next/static/.../auth-client.js")
// Or simpler — use the global:
await window.__authClient?.linkSocial?.({
  provider: "google",
  scopes: [
    "https://www.googleapis.com/auth/calendar.events.owned",
    "https://www.googleapis.com/auth/calendar.freebusy",
  ],
  callbackURL: window.location.href,
})
```

If the global isn't exposed, add a temporary button to
`apps/mirror/features/settings/components/settings-panel.tsx` that
calls `authClient.linkSocial(...)`, click it, then revert the change
before committing.

Follow the Google consent prompt and grant the scopes.

### 1.d — Re-inspect the account row after the redirect

Re-run the `findOne` query from Step 1.b.

**Record:**
- [ ] `scope` field value (after linkSocial):
- [ ] Did the row's `_id` change (new row created vs same row updated)?
- [ ] `accessToken` value differs from Step 1.b?
- [ ] `refreshToken` now present (if it was absent before)?

**Decision:**
- If `scope` is updated on the SAME row and tokens refreshed → incremental
  `linkSocial` works. Settings UX uses a "Connect Calendar" button that
  calls `authClient.linkSocial` exactly as above.
- If a NEW row was created, or `scope` stayed unchanged, or tokens did
  not refresh → Settings UX must use a "Reconnect Google Calendar" flow
  that signs the user out of Google and re-prompts with the full scope
  set. The behavior to implement:
  1. Show a "Reconnect Google Calendar" button.
  2. On click: call `authClient.signOut()` then redirect to a
     Google-sign-in URL with the Calendar scopes in the consent prompt.

## Step 2 — server-side access-token resolution

**Goal:** confirm an action running inside a Convex action can obtain
a valid Google access token for the owner. This is the gap the
`getOwnerCalendarAccessToken` helper currently fills only for
not-expired tokens; refresh is a TODO.

### 2.a — Confirm `getOwnerCalendarAccessToken` returns `kind: "ok"` for a freshly linked account

Add a one-off temporary action in `packages/convex/convex/calendar/__tmp_spike.ts`:

```ts
"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getOwnerCalendarAccessToken } from "./tokens";

export const spikeReadToken = internalAction({
  args: { authId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const status = await getOwnerCalendarAccessToken(ctx, args.authId);
    // Redact the access token before returning — never log it.
    if (status.kind === "ok") {
      return { kind: "ok", accessTokenPrefix: status.accessToken.slice(0, 8),
        expiresAtMs: status.expiresAtMs, presentScopes: status.presentScopes };
    }
    return status;
  },
});
```

Run it:

```bash
cd packages/convex
npx convex run --no-push calendar/__tmp_spike:spikeReadToken \
  '{"authId":"<auth-user-id>"}'
```

**Record:**
- [ ] Status `kind`:
- [ ] If `ok`, was `expiresAtMs` in the future (delta seconds from now):
- [ ] `presentScopes` contains both Calendar scopes (yes/no):

### 2.b — Force expiry, observe the `token_expired` branch

In a terminal:

```bash
cd packages/convex
npx convex run --no-push 'betterAuth/adapter:updateOne' '{
  "model": "account",
  "where": [
    { "field": "providerId", "value": "google" },
    { "field": "userId", "value": "<auth-user-id>" }
  ],
  "input": { "update": { "accessTokenExpiresAt": 1 } }
}'
```

Re-run `spikeReadToken`. It should now return
`{ kind: "token_expired", refreshTokenPresent: true|false }`.

### 2.c — Decide the refresh path

Two options to implement in `tokens.ts`:

**Option A:** call Better Auth's `/get-access-token` HTTP endpoint
from the action with the user's session cookie. Pro: BA handles the
refresh + write-back of the new token to the account row. Con: requires
a session cookie, which an action handler does not have.

**Option B:** in the action, read `refreshToken` from the account row
and call Google's `https://oauth2.googleapis.com/token` directly with
`grant_type=refresh_token`. Write the new `accessToken` +
`accessTokenExpiresAt` back to the account row via
`components.betterAuth.adapter.updateOne`. Pro: no session needed.
Con: we're maintaining the refresh flow ourselves.

**Decision:**
- [ ] Option A
- [ ] Option B
- [ ] Other (describe):

Reason:

## Step 3 — `calendar.events.owned` insert on `primary`

**Goal:** prove the narrow scope can create events on the owner's
primary calendar, before committing to it across actions, tools, docs,
and the Google verification submission.

In the same `__tmp_spike.ts`, add:

```ts
import { createGoogleCalendarClient } from "./googleApi";

export const spikeInsertEvent = internalAction({
  args: { authId: v.string(), accessToken: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const client = createGoogleCalendarClient(args.accessToken);
    const event = await client.insertEvent({
      calendarId: "primary",
      sendUpdates: "none",
      summary: "PLAN_015 spike — DELETE ME",
      description: "Spike event — safe to delete.",
      start: { dateTime: "2026-06-01T15:00:00-07:00", timeZone: "America/Los_Angeles" },
      end:   { dateTime: "2026-06-01T15:30:00-07:00", timeZone: "America/Los_Angeles" },
      attendees: [{ email: "<your-google-email>" }],
    });
    return event;
  },
});
```

Run it with the access token captured from Step 2.a (paste the full
token from a separate run that does not redact it; **do not commit**).

**Record:**
- [ ] HTTP status (read from the action's exception or success):
- [ ] Event id returned (yes/no):
- [ ] Event visible on Google Calendar (open primary calendar in browser):
- [ ] If failure, the `GoogleCalendarError.kind` value:

**Decision:**
- If success → keep `calendar.events.owned`. No code changes needed.
- If `forbidden`/`unauthorized` → widen scope to
  `https://www.googleapis.com/auth/calendar.events` (still narrower than
  full `https://www.googleapis.com/auth/calendar`). Update
  `REQUIRED_CALENDAR_SCOPES` in `tokens.ts` and re-run the spike from
  Step 1.

## Step 4 — token encryption flip

**Goal:** decide if `account.encryptOAuthTokens: true` can be enabled
safely.

### 4.a — Read the current tokens (plaintext)

The token capture from Step 1.d and Step 2.a is the baseline.

### 4.b — Enable encryption

Edit `packages/convex/convex/auth/client.ts`:

```ts
account: {
  accountLinking: { enabled: true, trustedProviders: ["google"] },
  encryptOAuthTokens: true,  // <- new
},
```

Restart Convex dev. **Do not commit this change yet.**

### 4.c — Confirm existing sign-in still works

Open a new Incognito window and sign in with the same Google account
used in Step 1. You should reach the profile page without errors.

### 4.d — Inspect the account row

Re-run the `adapter:findOne` query from Step 1.b. The `accessToken` /
`refreshToken` should now be opaque encrypted blobs (different length /
shape).

**Decision:**
- [ ] Sign-in still works AND tokens look encrypted → safe to commit
  the `encryptOAuthTokens: true` flip in a separate slice.
- [ ] Sign-in broke OR tokens still plaintext → revert and file a
  follow-up; flip stays deferred.

### 4.e — Verify the existing plaintext rows

Critical: the encryption is forward-only. Rows that were stored
plaintext BEFORE the flip stay plaintext. The `getOwnerCalendarAccessToken`
helper does not currently distinguish — both decrypt the same way at the
BA layer.

**Record:**
- [ ] After flipping encryption, did the existing dev row still resolve
  through `spikeReadToken`?

## After the spike

Once every checkbox above has a result:

1. Update `packages/convex/convex/calendar/tokens.ts` with the refresh
   implementation (Option A or B from Step 2.c).
2. Implement Settings UI with the connect/reconnect UX selected by
   Step 1.d.
3. Implement the agent tools and the Calendar actions. Use
   `REQUIRED_CALENDAR_SCOPES` updated per Step 3 if a wider scope was
   needed.
4. Open a follow-up PR that flips `encryptOAuthTokens: true` if Step 4
   passed.
5. Delete `packages/convex/convex/calendar/__tmp_spike.ts` —
   **the spike file must not ship**.
6. Move this file to `workspace/spikes/completed/` with the results
   filled in.

## Safety rules

- Never paste access tokens or refresh tokens into chat or commit
  messages. Use prefix snippets only (`ya29.…` first 8 chars).
- The `__tmp_spike.ts` file is for local verification — its presence
  in a PR is a blocker.
- If anything in Step 4 breaks existing sign-in, revert the change to
  `auth/client.ts` immediately. The encryption flip is not urgent.
