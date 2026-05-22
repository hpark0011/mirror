/// <reference types="vite/client" />

import { describe, expect, it, vi } from "vitest";
import {
  deriveConnectionStatus,
  findMissingScopes,
  getOwnerCalendarAccessToken,
  parseScopeString,
  readOwnerCalendarConnectionStatus,
  REQUIRED_CALENDAR_SCOPES,
} from "../tokens";

describe("parseScopeString", () => {
  it("returns empty array for null/undefined/empty", () => {
    expect(parseScopeString(null)).toEqual([]);
    expect(parseScopeString(undefined)).toEqual([]);
    expect(parseScopeString("")).toEqual([]);
  });

  it("splits on whitespace and trims", () => {
    expect(parseScopeString("a b c")).toEqual(["a", "b", "c"]);
    expect(parseScopeString("  a   b\tc\n")).toEqual(["a", "b", "c"]);
  });

  it("is idempotent on a normalized input", () => {
    const once = parseScopeString("a b c");
    expect(parseScopeString(once.join(" "))).toEqual(once);
  });
});

describe("findMissingScopes", () => {
  it("returns the required scopes that are absent", () => {
    expect(findMissingScopes([], ["a", "b"])).toEqual(["a", "b"]);
    expect(findMissingScopes(["a"], ["a", "b"])).toEqual(["b"]);
    expect(findMissingScopes(["a", "b"], ["a", "b"])).toEqual([]);
  });

  it("ignores extra scopes the caller has but the spec did not require", () => {
    expect(findMissingScopes(["a", "b", "c"], ["a"])).toEqual([]);
  });

  it("defaults to the Calendar scopes constant", () => {
    expect(findMissingScopes([])).toEqual([...REQUIRED_CALENDAR_SCOPES]);
  });
});

describe("deriveConnectionStatus", () => {
  it("returns not_connected when there is no account row", () => {
    expect(deriveConnectionStatus(null)).toEqual({ kind: "not_connected" });
  });

  it("returns missing_scopes when scopes are absent or insufficient", () => {
    const result = deriveConnectionStatus({
      scope: "openid email",
      accessToken: "ya29.token",
      accessTokenExpiresAt: Date.now() + 60_000,
    });
    expect(result.kind).toBe("missing_scopes");
    if (result.kind !== "missing_scopes") return;
    expect(result.missingScopes).toEqual([...REQUIRED_CALENDAR_SCOPES]);
  });

  it("returns ready when every required scope is present", () => {
    const result = deriveConnectionStatus({
      scope: `openid email ${REQUIRED_CALENDAR_SCOPES.join(" ")}`,
      accessToken: "ya29.token",
      accessTokenExpiresAt: Date.now() + 60_000,
      refreshToken: "1//rt",
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.refreshTokenPresent).toBe(true);
    expect(typeof result.expiresAtMs).toBe("number");
  });

  it("flags refresh-token absence in the ready state", () => {
    const result = deriveConnectionStatus({
      scope: REQUIRED_CALENDAR_SCOPES.join(" "),
      accessToken: "ya29.token",
    });
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.refreshTokenPresent).toBe(false);
    expect(result.expiresAtMs).toBeUndefined();
  });
});

// `tokens.ts` is a pure module that reads through `ctx.runQuery`. Tests use
// a fake ctx whose `runQuery` returns a configured Better Auth `account` row
// for the first call (the only call these helpers make). This is the same
// fake-ctx pattern `betaAllowlist/__tests__/send-otp.test.ts` uses for
// `runSendVerificationOtpGate` — no BA component registration needed.
function makeCtxWithAccountRow(row: unknown) {
  const runQuery = vi.fn(async () => row);
  // The ctx union (GenericQueryCtx | GenericActionCtx) has many fields we
  // don't touch; the only one read by tokens.ts is `runQuery`. Cast through
  // unknown to keep the test free of fake fields the implementation never
  // reads.
  return {
    ctx: { runQuery } as unknown as Parameters<
      typeof readOwnerCalendarConnectionStatus
    >[0],
    runQuery,
  };
}

describe("readOwnerCalendarConnectionStatus", () => {
  it("filters the BA account lookup by providerId='google' and userId=authId", async () => {
    const { ctx, runQuery } = makeCtxWithAccountRow(null);
    await readOwnerCalendarConnectionStatus(ctx, "auth_user_alice");
    expect(runQuery).toHaveBeenCalledTimes(1);
    const args = runQuery.mock.calls[0]![1] as {
      model: string;
      where: { field: string; value: unknown }[];
    };
    expect(args.model).toBe("account");
    expect(args.where).toEqual(
      expect.arrayContaining([
        { field: "providerId", value: "google" },
        { field: "userId", value: "auth_user_alice" },
      ]),
    );
  });

  it("maps a null row to not_connected", async () => {
    const { ctx } = makeCtxWithAccountRow(null);
    const status = await readOwnerCalendarConnectionStatus(ctx, "auth_alice");
    expect(status).toEqual({ kind: "not_connected" });
  });

  it("maps a scoped row to ready", async () => {
    const { ctx } = makeCtxWithAccountRow({
      scope: REQUIRED_CALENDAR_SCOPES.join(" "),
      accessToken: "ya29.token",
      accessTokenExpiresAt: 1_900_000_000_000,
      refreshToken: "1//rt",
    });
    const status = await readOwnerCalendarConnectionStatus(ctx, "auth_alice");
    expect(status.kind).toBe("ready");
  });
});

describe("getOwnerCalendarAccessToken", () => {
  it("returns ok when the token is present, scoped, and unexpired", async () => {
    const now = 1_700_000_000_000;
    const { ctx } = makeCtxWithAccountRow({
      scope: REQUIRED_CALENDAR_SCOPES.join(" "),
      accessToken: "ya29.token",
      accessTokenExpiresAt: now + 60_000,
      refreshToken: "1//rt",
    });
    const status = await getOwnerCalendarAccessToken(ctx, "auth_alice", {
      nowMs: now,
    });
    expect(status.kind).toBe("ok");
    if (status.kind !== "ok") return;
    expect(status.accessToken).toBe("ya29.token");
    expect(status.expiresAtMs).toBe(now + 60_000);
  });

  it("returns not_connected when no row exists", async () => {
    const { ctx } = makeCtxWithAccountRow(null);
    const status = await getOwnerCalendarAccessToken(ctx, "auth_alice");
    expect(status.kind).toBe("not_connected");
  });

  it("returns missing_scopes when Calendar scopes are absent", async () => {
    const { ctx } = makeCtxWithAccountRow({
      scope: "openid email",
      accessToken: "ya29.token",
    });
    const status = await getOwnerCalendarAccessToken(ctx, "auth_alice");
    expect(status.kind).toBe("missing_scopes");
  });

  it("returns no_access_token when scopes are fine but accessToken is missing/empty", async () => {
    const { ctx } = makeCtxWithAccountRow({
      scope: REQUIRED_CALENDAR_SCOPES.join(" "),
      accessToken: null,
    });
    const status = await getOwnerCalendarAccessToken(ctx, "auth_alice");
    expect(status.kind).toBe("no_access_token");
  });

  it("returns token_expired when nowMs >= expiresAt", async () => {
    const now = 1_700_000_000_000;
    const { ctx } = makeCtxWithAccountRow({
      scope: REQUIRED_CALENDAR_SCOPES.join(" "),
      accessToken: "ya29.token",
      accessTokenExpiresAt: now - 1,
      refreshToken: "1//rt",
    });
    const status = await getOwnerCalendarAccessToken(ctx, "auth_alice", {
      nowMs: now,
    });
    expect(status.kind).toBe("token_expired");
    if (status.kind !== "token_expired") return;
    expect(status.refreshTokenPresent).toBe(true);
  });

  it("propagates refreshTokenPresent=false when expired and no refresh token", async () => {
    const now = 1_700_000_000_000;
    const { ctx } = makeCtxWithAccountRow({
      scope: REQUIRED_CALENDAR_SCOPES.join(" "),
      accessToken: "ya29.token",
      accessTokenExpiresAt: now - 1,
      refreshToken: null,
    });
    const status = await getOwnerCalendarAccessToken(ctx, "auth_alice", {
      nowMs: now,
    });
    expect(status.kind).toBe("token_expired");
    if (status.kind !== "token_expired") return;
    expect(status.refreshTokenPresent).toBe(false);
  });
});
