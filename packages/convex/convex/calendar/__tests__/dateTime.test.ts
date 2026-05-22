import { describe, expect, it } from "vitest";
import {
  checkBookingWindow,
  expandWindowForBuffer,
  resolveLocalDateTime,
  utcMsToRfc3339,
} from "../dateTime";

describe("resolveLocalDateTime", () => {
  it("converts a well-defined local time to UTC", () => {
    // 2026-05-22 15:00 in America/Los_Angeles is UTC-07:00 (PDT)
    const result = resolveLocalDateTime({
      year: 2026,
      month: 5,
      day: 22,
      hour: 15,
      minute: 0,
      timeZone: "America/Los_Angeles",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.utcMs).toBe(Date.UTC(2026, 4, 22, 22, 0, 0));
    expect(result.rfc3339).toBe("2026-05-22T15:00:00-07:00");
    expect(result.timeZone).toBe("America/Los_Angeles");
  });

  it("emits an offset suffix (no [tz] annotation) so Google accepts it", () => {
    const result = resolveLocalDateTime({
      year: 2026,
      month: 1,
      day: 15,
      hour: 9,
      minute: 30,
      timeZone: "Europe/London",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rfc3339).not.toMatch(/\[/);
    expect(result.rfc3339).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it("rejects out-of-range components", () => {
    const result = resolveLocalDateTime({
      year: 2026,
      month: 13,
      day: 1,
      hour: 10,
      minute: 0,
      timeZone: "America/Los_Angeles",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_local_time");
  });

  it("rejects nonexistent local times (spring forward gap)", () => {
    // 2026-03-08 02:30 in America/Los_Angeles does not exist — clock
    // jumps from 02:00 PST to 03:00 PDT.
    const result = resolveLocalDateTime({
      year: 2026,
      month: 3,
      day: 8,
      hour: 2,
      minute: 30,
      timeZone: "America/Los_Angeles",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("nonexistent_local_time");
  });

  it("rejects ambiguous local times (fall back repeat)", () => {
    // 2026-11-01 01:30 in America/Los_Angeles occurs twice — clock
    // falls back from 02:00 PDT to 01:00 PST.
    const result = resolveLocalDateTime({
      year: 2026,
      month: 11,
      day: 1,
      hour: 1,
      minute: 30,
      timeZone: "America/Los_Angeles",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("ambiguous_local_time");
  });

  it("treats an unrecognized timezone as invalid", () => {
    const result = resolveLocalDateTime({
      year: 2026,
      month: 5,
      day: 22,
      hour: 10,
      minute: 0,
      timeZone: "Not/A_Real_Zone",
    });
    expect(result.ok).toBe(false);
  });
});

describe("checkBookingWindow", () => {
  const nowMs = Date.UTC(2026, 4, 22, 12, 0, 0);

  it("accepts a meeting inside the booking window", () => {
    const start = nowMs + 2 * 60 * 60_000; // +2h
    const result = checkBookingWindow(start, {
      nowMs,
      minLeadTimeMinutes: 60,
      maxDaysAhead: 30,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects meetings shorter than minimum lead time", () => {
    const start = nowMs + 30 * 60_000; // +30m, need 60m
    const result = checkBookingWindow(start, {
      nowMs,
      minLeadTimeMinutes: 60,
      maxDaysAhead: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_soon");
  });

  it("rejects meetings beyond maxDaysAhead", () => {
    const start = nowMs + 31 * 24 * 60 * 60_000; // +31d, limit 30
    const result = checkBookingWindow(start, {
      nowMs,
      minLeadTimeMinutes: 60,
      maxDaysAhead: 30,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_far");
  });
});

describe("expandWindowForBuffer", () => {
  it("expands a meeting window symmetrically", () => {
    const start = 1_000_000_000_000;
    const end = start + 60 * 60_000; // +60m
    const expanded = expandWindowForBuffer(start, end, 15);
    expect(expanded.checkStartUtcMs).toBe(start - 15 * 60_000);
    expect(expanded.checkEndUtcMs).toBe(end + 15 * 60_000);
  });

  it("is a no-op when buffer is zero", () => {
    const start = 1_000_000_000_000;
    const end = start + 60 * 60_000;
    const expanded = expandWindowForBuffer(start, end, 0);
    expect(expanded.checkStartUtcMs).toBe(start);
    expect(expanded.checkEndUtcMs).toBe(end);
  });
});

describe("utcMsToRfc3339", () => {
  it("round-trips with resolveLocalDateTime", () => {
    const resolved = resolveLocalDateTime({
      year: 2026,
      month: 7,
      day: 4,
      hour: 14,
      minute: 30,
      timeZone: "America/New_York",
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const formatted = utcMsToRfc3339(resolved.utcMs, "America/New_York");
    expect(formatted).toBe(resolved.rfc3339);
  });
});
