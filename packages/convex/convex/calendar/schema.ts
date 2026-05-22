import { defineTable } from "convex/server";
import { v } from "convex/values";

// Calendar provider validator. Single-element union today (google), shaped as
// a union so adding a second provider (e.g. microsoft) does not require
// reshaping every consumer site.
export const calendarProviderValidator = v.literal("google");

// Per-owner calendar connection + scheduling preferences. One row per
// `(userId, provider)` pair; the row is upserted by the Settings mutation
// when the owner enables scheduling or saves preferences.
//
// `enabled === false` means the owner has configured the connection but
// turned scheduling off for the public clone. The clone-agent tool reads
// this row through `getSchedulingContext` and reports `enabled: false` to
// the model so it can decline scheduling requests cleanly.
//
// Tokens are NOT stored on this row — they live on the Better Auth
// `account` row keyed by the owner's `authId`. This table only stores
// owner-controlled preferences.
export const calendarConnectionFields = {
  userId: v.id("users"),
  provider: calendarProviderValidator,
  enabled: v.boolean(),
  // Google Calendar id; `"primary"` targets the signed-in user's primary
  // calendar. The Settings UI does not expose alternative calendar ids in
  // v1, but the field is stored so a future calendar-picker does not
  // require a migration.
  calendarId: v.string(),
  // IANA timezone (e.g. `"America/Los_Angeles"`). Validated at the
  // mutation boundary against the runtime ICU table — see
  // `calendar/validators.ts:isValidIanaTimeZone`.
  timeZone: v.string(),
  defaultDurationMinutes: v.number(),
  minLeadTimeMinutes: v.number(),
  maxDaysAhead: v.number(),
  bufferMinutes: v.number(),
  createGoogleMeet: v.boolean(),
  updatedAt: v.number(),
};

export const calendarConnectionsTable = defineTable(calendarConnectionFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_provider", ["userId", "provider"]);

// Persisted record of every meeting the clone has scheduled, scoped to the
// profile owner. The row is written by `internal.calendar.mutations
// .recordScheduledMeeting` after `events.insert` succeeds.
//
// `idempotencyKey` is a deterministic SHA-256 hash of
// `(profileOwnerId, viewerId, conversationId, startUtcMs, durationMinutes,
//  attendeeEmail)`. The mutation looks up by-key before inserting so a
// retried `scheduleMeeting` tool call (e.g. caused by streaming retries)
// returns the existing row instead of double-booking.
//
// `canceledAt` is reserved for cancellation/rescheduling. Idempotency
// checks ignore canceled rows so a user can re-book an identical slot
// after cancellation without colliding with the original row.
export const scheduledMeetingFields = {
  profileOwnerId: v.id("users"),
  viewerId: v.id("users"),
  conversationId: v.id("conversations"),
  provider: calendarProviderValidator,
  calendarId: v.string(),
  googleEventId: v.string(),
  htmlLink: v.optional(v.string()),
  hangoutLink: v.optional(v.string()),
  summary: v.string(),
  startUtcMs: v.number(),
  endUtcMs: v.number(),
  timeZone: v.string(),
  durationMinutes: v.number(),
  attendeeEmail: v.string(),
  idempotencyKey: v.string(),
  createdAt: v.number(),
  // Reserved for future cancellation/rescheduling and out-of-band
  // reconciliation. V1 never sets it; idempotency lookups treat only
  // non-canceled rows as active duplicates.
  canceledAt: v.optional(v.number()),
};

export const scheduledMeetingsTable = defineTable(scheduledMeetingFields)
  .index("by_profileOwnerId", ["profileOwnerId"])
  .index("by_viewerId", ["viewerId"])
  .index("by_conversationId", ["conversationId"])
  .index("by_idempotencyKey", ["idempotencyKey"]);
