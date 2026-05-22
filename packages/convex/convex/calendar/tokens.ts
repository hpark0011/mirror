// Google Calendar token / connection status seam.
//
// Reads the Better Auth `account` row for `(userId=<authId>, providerId="google")`
// and derives a typed status the rest of the system can branch on without
// re-implementing scope/expiry math. The exposed surface stays *narrow*:
//   - `readOwnerCalendarConnectionStatus(ctx, authId)`
//        → safe to call from a public query. Returns scope/expiry metadata
//          but NOT the access token (queries can read it from the BA row,
//          but the principle here is principle-of-least-exposure: tokens
//          stay inside the action-only helper).
//   - `getOwnerCalendarAccessToken(ctx, authId)`
//        → action-only callers (the Calendar action that calls Google).
//          Returns the access token when it's present, scoped, and not
//          past `accessTokenExpiresAt`.
//
// REFRESH (TODO): Better Auth 1.6.9 ships a `/get-access-token` HTTP
// endpoint that handles refresh, and `@convex-dev/better-auth` 0.12.1
// exposes the account row but not (yet, in this version) a server-side
// `getAccessToken`-equivalent. The behavior of refresh from inside a
// Convex action is one of the questions the OAuth spike answers; this
// file marks the seam (`token_expired` status) without implementing the
// refresh yet. See `workspace/spikes/2026-05-22-google-calendar-oauth-spike.md`.
//
// CROSS-USER ISOLATION: callers MUST pass an `authId` they derived
// server-side (e.g. `appUser.authId` after `getAppUser(ctx, ctx.user._id)`
// in an owner-only handler, or via the chat conversation's
// `profileOwnerId → users.authId` lookup). Never accept the authId as a
// client-facing tool argument — see `.claude/rules/agent-parity.md`.

import { type GenericQueryCtx, type GenericActionCtx } from "convex/server";
import { components } from "../_generated/api";
import { type DataModel } from "../_generated/dataModel";

export const GOOGLE_PROVIDER_ID = "google" as const;

/**
 * Narrow Calendar scopes the scheduling feature needs. Adding a broader
 * Calendar scope here without a documented reason is a security
 * regression — every scope expands OAuth-verification surface area.
 */
export const REQUIRED_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.owned",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

export type RequiredCalendarScope = (typeof REQUIRED_CALENDAR_SCOPES)[number];

/** Pure: split Google's space-separated `scope` string into an array.
 * Trims and removes empty entries. Idempotent on already-normalized
 * input. */
export function parseScopeString(
  scope: string | null | undefined,
): string[] {
  if (!scope) return [];
  return scope
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Pure: which of `required` are missing from `present`. Returns a new
 * array so the caller can include it in an error result. */
export function findMissingScopes(
  present: readonly string[],
  required: readonly string[] = REQUIRED_CALENDAR_SCOPES,
): string[] {
  const presentSet = new Set(present);
  return required.filter((s) => !presentSet.has(s));
}

/** Pure: connection status derived from a (possibly-null) Better Auth
 * account row's scope/expiry fields. Exposed so the query and action
 * helpers below share one truth table. */
export function deriveConnectionStatus(account: {
  scope?: string | null;
  accessToken?: string | null;
  accessTokenExpiresAt?: number | null;
  refreshToken?: string | null;
} | null): ConnectionStatus {
  if (!account) return { kind: "not_connected" };
  const presentScopes = parseScopeString(account.scope);
  const missingScopes = findMissingScopes(presentScopes);
  if (missingScopes.length > 0) {
    return { kind: "missing_scopes", presentScopes, missingScopes };
  }
  const refreshTokenPresent =
    typeof account.refreshToken === "string" && account.refreshToken.length > 0;
  const expiresAtMs =
    typeof account.accessTokenExpiresAt === "number"
      ? account.accessTokenExpiresAt
      : undefined;
  return {
    kind: "ready",
    presentScopes,
    refreshTokenPresent,
    ...(expiresAtMs !== undefined ? { expiresAtMs } : {}),
  };
}

export type ConnectionStatus =
  | { kind: "not_connected" }
  | {
      kind: "missing_scopes";
      presentScopes: string[];
      missingScopes: string[];
    }
  | {
      kind: "ready";
      presentScopes: string[];
      refreshTokenPresent: boolean;
      expiresAtMs?: number;
    };

export type AccessTokenStatus =
  | {
      kind: "ok";
      accessToken: string;
      presentScopes: string[];
      expiresAtMs?: number;
    }
  | { kind: "not_connected" }
  | {
      kind: "missing_scopes";
      presentScopes: string[];
      missingScopes: string[];
    }
  | { kind: "no_access_token" }
  | { kind: "token_expired"; refreshTokenPresent: boolean };

type CtxWithRunQuery =
  | GenericQueryCtx<DataModel>
  | GenericActionCtx<DataModel>;

type BetterAuthAccountRow = {
  scope?: string | null;
  accessToken?: string | null;
  accessTokenExpiresAt?: number | null;
  refreshToken?: string | null;
};

async function findOwnerGoogleAccount(
  ctx: CtxWithRunQuery,
  authId: string,
): Promise<BetterAuthAccountRow | null> {
  // Better Auth stores Google's OAuth state on the `account` row keyed
  // by `(providerId, userId)`. The component schema has a
  // `providerId_userId` index, so a `where` filter on both fields
  // resolves to a unique row.
  const row = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "providerId", value: GOOGLE_PROVIDER_ID },
      { field: "userId", value: authId },
    ],
  })) as BetterAuthAccountRow | null;
  return row;
}

/** Query-safe: derive the owner's Calendar connection status without
 * exposing the raw access token. Use this from `queryConnectionStatus`
 * (Settings) and from any internal query that needs to gate behavior on
 * whether the owner is reconnect-required vs. ready.
 *
 * `authId` MUST come from a server-derived source — never accept it from
 * a tool/mutation argument. See file header. */
export async function readOwnerCalendarConnectionStatus(
  ctx: CtxWithRunQuery,
  authId: string,
): Promise<ConnectionStatus> {
  const account = await findOwnerGoogleAccount(ctx, authId);
  return deriveConnectionStatus(account);
}

/**
 * Action-side: returns the access token when the row is present,
 * scoped, and unexpired. Otherwise returns a typed reason.
 *
 * v1 does NOT refresh. If the stored access token is past
 * `accessTokenExpiresAt`, returns `{ kind: "token_expired", refreshTokenPresent }`
 * — callers map this to a "needs reconnect" message in the agent tool
 * result. The OAuth spike decides whether the refresh path goes through
 * Better Auth's `/get-access-token` endpoint or a direct Google
 * `oauth2/v4/token` call.
 *
 * `authId` MUST come from a server-derived source. See file header.
 */
export async function getOwnerCalendarAccessToken(
  ctx: CtxWithRunQuery,
  authId: string,
  options: { nowMs?: number } = {},
): Promise<AccessTokenStatus> {
  const account = await findOwnerGoogleAccount(ctx, authId);
  if (!account) return { kind: "not_connected" };
  const presentScopes = parseScopeString(account.scope);
  const missingScopes = findMissingScopes(presentScopes);
  if (missingScopes.length > 0) {
    return { kind: "missing_scopes", presentScopes, missingScopes };
  }
  if (typeof account.accessToken !== "string" || account.accessToken.length === 0) {
    return { kind: "no_access_token" };
  }
  const refreshTokenPresent =
    typeof account.refreshToken === "string" && account.refreshToken.length > 0;
  const expiresAtMs =
    typeof account.accessTokenExpiresAt === "number"
      ? account.accessTokenExpiresAt
      : undefined;
  if (expiresAtMs !== undefined) {
    const nowMs = options.nowMs ?? Date.now();
    if (nowMs >= expiresAtMs) {
      return { kind: "token_expired", refreshTokenPresent };
    }
  }
  return {
    kind: "ok",
    accessToken: account.accessToken,
    presentScopes,
    ...(expiresAtMs !== undefined ? { expiresAtMs } : {}),
  };
}
