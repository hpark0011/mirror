import { v } from "convex/values";
import { authQuery } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import { readOwnerCalendarConnectionStatus } from "./tokens";

// Three-state result for the Settings UI. The internal-token helper
// returns a finer-grained discriminated union; this query collapses it
// into a state the UI directly renders:
//   - `disconnected`    → show "Connect Google Calendar" button.
//   - `needs_reconnect` → show "Reconnect" button + keep scheduling off.
//   - `ready`           → show preferences + the scheduling-enabled
//                         toggle.
//
// `preferences` is `null` until the owner saves their first scheduling
// config (the `calendarConnections` upsert mutation lands in a later
// slice — see `workspace/plans/2026-05-22-chat-google-calendar-scheduling-plan.md`).
const calendarConnectionStateValidator = v.union(
  v.literal("disconnected"),
  v.literal("needs_reconnect"),
  v.literal("ready"),
);

const calendarPreferencesValidator = v.object({
  enabled: v.boolean(),
  calendarId: v.string(),
  timeZone: v.string(),
  defaultDurationMinutes: v.number(),
  minLeadTimeMinutes: v.number(),
  maxDaysAhead: v.number(),
  bufferMinutes: v.number(),
  createGoogleMeet: v.boolean(),
});

const queryConnectionStatusReturnValidator = v.object({
  state: calendarConnectionStateValidator,
  presentScopes: v.array(v.string()),
  missingScopes: v.array(v.string()),
  preferences: v.union(calendarPreferencesValidator, v.null()),
});

/**
 * Owner-only Settings query. Returns the connection state + saved
 * preferences (or `null` when the owner has never saved any).
 *
 * Cross-user isolation: scoped by `getAppUser(ctx, ctx.user._id)` —
 * never accepts a `userId` argument. See `.claude/rules/embeddings.md`
 * and `.claude/rules/agent-parity.md`.
 *
 * Note: the route that wraps this query is already owner-only (the
 * Settings page lives at `/@<username>/settings`); the `authQuery`
 * boundary guarantees an authenticated viewer, and reading by the
 * authenticated app user's id makes it impossible to query a different
 * owner's connection state through this function.
 */
export const queryConnectionStatus = authQuery({
  args: {},
  returns: queryConnectionStatusReturnValidator,
  handler: async (ctx) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const connectionStatus = await readOwnerCalendarConnectionStatus(
      ctx,
      appUser.authId,
    );
    const connectionRow = await ctx.db
      .query("calendarConnections")
      .withIndex("by_userId_and_provider", (q) =>
        q.eq("userId", appUser._id).eq("provider", "google"),
      )
      .unique();

    // Map the token-side status to the UI-facing 3-state. `disconnected`
    // also covers the "connected to Google but no Calendar scopes" only
    // transiently — if scopes are present we're either `ready` or in
    // the missing-scopes branch.
    const state: "disconnected" | "needs_reconnect" | "ready" =
      connectionStatus.kind === "not_connected"
        ? "disconnected"
        : connectionStatus.kind === "missing_scopes"
          ? "needs_reconnect"
          : "ready";

    const presentScopes =
      connectionStatus.kind === "not_connected"
        ? []
        : connectionStatus.presentScopes;
    const missingScopes =
      connectionStatus.kind === "missing_scopes"
        ? connectionStatus.missingScopes
        : [];

    const preferences = connectionRow
      ? {
          enabled: connectionRow.enabled,
          calendarId: connectionRow.calendarId,
          timeZone: connectionRow.timeZone,
          defaultDurationMinutes: connectionRow.defaultDurationMinutes,
          minLeadTimeMinutes: connectionRow.minLeadTimeMinutes,
          maxDaysAhead: connectionRow.maxDaysAhead,
          bufferMinutes: connectionRow.bufferMinutes,
          createGoogleMeet: connectionRow.createGoogleMeet,
        }
      : null;

    return {
      state,
      presentScopes,
      missingScopes,
      preferences,
    };
  },
});
