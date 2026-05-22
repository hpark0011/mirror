// Timezone-safe local-date conversion for the scheduling tools.
//
// Why Temporal: server local timezone is not guaranteed (Convex actions
// can run on any host) and Date's tz handling is too implicit. Temporal
// gives us exact, explicit answers about (a) what UTC moment a structured
// local time refers to and (b) whether that local time is nonexistent or
// ambiguous due to a DST transition. Both cases are real-world: 2:30am on
// the spring-forward day in America/Los_Angeles does not exist, and
// 1:30am on the fall-back day occurs twice. The clone agent must ask the
// visitor to pick another time in either case rather than silently
// guessing — `resolveLocalDateTime` returns a typed reason the agent can
// surface.
//
// Pure module: no Convex runtime imports.

import { Temporal } from "@js-temporal/polyfill";

export type LocalDateTimeInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
};

export type ResolvedLocalDateTime = {
  ok: true;
  /** UTC milliseconds since epoch. Suitable for storage and conflict math. */
  utcMs: number;
  /** Offset-bearing RFC3339 string, e.g. `"2026-05-22T15:00:00-07:00"`.
   * Suitable as the `dateTime` field in a Google Calendar event payload. */
  rfc3339: string;
  /** Normalized IANA timezone the caller supplied. */
  timeZone: string;
};

export type LocalDateTimeFailure = {
  ok: false;
  reason:
    | "invalid_local_time"
    | "ambiguous_local_time"
    | "nonexistent_local_time";
  message: string;
};

export type LocalDateTimeResult = ResolvedLocalDateTime | LocalDateTimeFailure;

/**
 * Resolve a structured local date/time + IANA timezone into a single UTC
 * moment. Returns a discriminated result so the caller (the scheduling
 * tools / actions) can map each failure mode to a typed reason the model
 * can explain to the visitor.
 *
 * DST handling: `disambiguation: 'reject'` throws when a local time is
 * not unique, but the @js-temporal/polyfill@0.5.x error message is the
 * same generic "multiple instants found" string for both gap
 * (nonexistent) and fold (ambiguous) cases. We distinguish by retrying
 * with `'earlier'`/`'later'` and comparing the resulting local times:
 * if the local clock-face time matches the input in both branches the
 * minute occurred twice (ambiguous); if it differs the minute was
 * skipped (nonexistent).
 */
export function resolveLocalDateTime(
  input: LocalDateTimeInput,
): LocalDateTimeResult {
  if (!isValidComponents(input)) {
    return {
      ok: false,
      reason: "invalid_local_time",
      message: "Local date/time components are out of range.",
    };
  }
  let pdt: Temporal.PlainDateTime;
  try {
    pdt = Temporal.PlainDateTime.from(
      {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.hour,
        minute: input.minute,
        second: 0,
        millisecond: 0,
      },
      { overflow: "reject" },
    );
  } catch (err) {
    return {
      ok: false,
      reason: "invalid_local_time",
      message: err instanceof Error ? err.message : "Invalid local time",
    };
  }
  try {
    const zdt = pdt.toZonedDateTime(input.timeZone, {
      disambiguation: "reject",
    });
    return {
      ok: true,
      utcMs: Number(zdt.epochMilliseconds),
      rfc3339: formatRfc3339(zdt),
      timeZone: input.timeZone,
    };
  } catch (err) {
    // Either the timezone is invalid or we hit a DST boundary. The
    // polyfill does not distinguish the two via the thrown message; we
    // retry to find out.
    try {
      const earlier = pdt.toZonedDateTime(input.timeZone, {
        disambiguation: "earlier",
      });
      const earlierLocal = earlier.toPlainDateTime();
      const localMatches = Temporal.PlainDateTime.compare(earlierLocal, pdt) === 0;
      if (localMatches) {
        return {
          ok: false,
          reason: "ambiguous_local_time",
          message:
            "This local time occurs twice in the selected timezone (clock fell back).",
        };
      }
      return {
        ok: false,
        reason: "nonexistent_local_time",
        message:
          "This local time does not exist in the selected timezone (clock skipped forward).",
      };
    } catch {
      return {
        ok: false,
        reason: "invalid_local_time",
        message:
          err instanceof Error
            ? `Invalid timezone or local time: ${err.message}`
            : "Invalid timezone or local time",
      };
    }
  }
}

function isValidComponents(input: LocalDateTimeInput): boolean {
  return (
    Number.isInteger(input.year) &&
    input.year >= 1970 &&
    input.year <= 9999 &&
    Number.isInteger(input.month) &&
    input.month >= 1 &&
    input.month <= 12 &&
    Number.isInteger(input.day) &&
    input.day >= 1 &&
    input.day <= 31 &&
    Number.isInteger(input.hour) &&
    input.hour >= 0 &&
    input.hour <= 23 &&
    Number.isInteger(input.minute) &&
    input.minute >= 0 &&
    input.minute <= 59
  );
}

function formatRfc3339(zdt: Temporal.ZonedDateTime): string {
  // Temporal's `toString()` includes the `[timeZone]` annotation that
  // Google Calendar's API rejects. Strip it; the offset is already in
  // the string, which is enough for `events.insert` when paired with a
  // separate `timeZone` field on `start`/`end`.
  const raw = zdt.toString({ smallestUnit: "second" });
  const annotationIdx = raw.indexOf("[");
  return annotationIdx === -1 ? raw : raw.slice(0, annotationIdx);
}

/** Booking-window check: the resolved UTC moment must sit between
 *  `now + minLeadTimeMinutes` and `now + maxDaysAhead * 24h`. */
export type BookingWindow = {
  nowMs: number;
  minLeadTimeMinutes: number;
  maxDaysAhead: number;
};

export type BookingWindowFailure = {
  ok: false;
  reason: "too_soon" | "too_far";
  message: string;
};

export function checkBookingWindow(
  startUtcMs: number,
  window: BookingWindow,
): { ok: true } | BookingWindowFailure {
  const earliestMs = window.nowMs + window.minLeadTimeMinutes * 60_000;
  const latestMs = window.nowMs + window.maxDaysAhead * 24 * 60 * 60_000;
  if (startUtcMs < earliestMs) {
    return {
      ok: false,
      reason: "too_soon",
      message: `Meeting must start at least ${window.minLeadTimeMinutes} minute(s) from now.`,
    };
  }
  if (startUtcMs > latestMs) {
    return {
      ok: false,
      reason: "too_far",
      message: `Meeting cannot be more than ${window.maxDaysAhead} day(s) ahead.`,
    };
  }
  return { ok: true };
}

/** Expand a meeting window by `bufferMinutes` on both sides. The stored
 * meeting row keeps the original start/end; only the conflict-check call
 * sees the expanded window. Returning a separate object makes that
 * separation explicit at every call site. */
export function expandWindowForBuffer(
  startUtcMs: number,
  endUtcMs: number,
  bufferMinutes: number,
): { checkStartUtcMs: number; checkEndUtcMs: number } {
  const bufferMs = bufferMinutes * 60_000;
  return {
    checkStartUtcMs: startUtcMs - bufferMs,
    checkEndUtcMs: endUtcMs + bufferMs,
  };
}

/** Convert a UTC millisecond moment back to an offset-bearing RFC3339
 * string in the supplied timezone. Used when constructing
 * `events.insert` payloads where we need `start.dateTime` for a derived
 * end time (start + duration), and by tests asserting the shape. */
export function utcMsToRfc3339(utcMs: number, timeZone: string): string {
  const instant = Temporal.Instant.fromEpochMilliseconds(utcMs);
  const zdt = instant.toZonedDateTimeISO(timeZone);
  return formatRfc3339(zdt);
}
