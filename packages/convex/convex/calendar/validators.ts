// Owner-supplied scheduling configuration is normalized at the
// `upsertConnectionSettings` mutation boundary. Convex `v.string()`/
// `v.number()` only check type, not shape — the helpers in this file are
// the trust boundary, mirroring the slug-normalizer pattern in
// `convex/content/slug.ts` (see `.claude/rules/identifiers.md`).
//
// Pure module: no Convex runtime imports, so it is safe to import from
// both Convex actions/mutations and unit tests.

/** Owner-configurable bounds. These bracket the model's freedom — the
 * clone agent reads the configured values verbatim through
 * `getSchedulingConfiguration` and is expected to honor them in its
 * conversation flow. The min/max here are sanity rails on the Settings
 * mutation, not product knobs the agent ever sees. */
export const SCHEDULING_BOUNDS = {
  defaultDurationMinutes: { min: 5, max: 480 },
  minLeadTimeMinutes: { min: 0, max: 7 * 24 * 60 },
  maxDaysAhead: { min: 1, max: 365 },
  bufferMinutes: { min: 0, max: 120 },
} as const;

export type SchedulingBoundKey = keyof typeof SCHEDULING_BOUNDS;

/** Sensible defaults for a newly enabled connection — used by the
 * Settings mutation when the owner toggles scheduling on without
 * explicitly setting every preference. */
export const SCHEDULING_DEFAULTS = {
  defaultDurationMinutes: 30,
  minLeadTimeMinutes: 60,
  maxDaysAhead: 30,
  bufferMinutes: 0,
  createGoogleMeet: false,
  calendarId: "primary",
} as const;

// `Intl.DateTimeFormat` accepts both IANA identifiers (`America/Los_Angeles`)
// AND fixed UTC offsets (`+09:00`). We want only the IANA form so DST
// transitions are correctly modeled by downstream Temporal calls. The
// explicit offset-pattern rejection here is what separates this helper
// from a thin Intl wrapper.
const UTC_OFFSET_PATTERN = /^[+-]\d{2}:?\d{2}$/;

/**
 * `Intl.DateTimeFormat` is the canonical runtime check for an IANA
 * timezone identifier: the constructor throws `RangeError` on an
 * unrecognized zone, and the normalized id is available via
 * `resolvedOptions().timeZone`. The fallback `"UTC"` would silently mask
 * a malformed input — we never want that, so the constructor throw is
 * the signal we rely on.
 *
 * Convex Node runtime ships with full ICU, so this works without extra
 * setup. Common malformed inputs (empty string, an offset like `+09:00`,
 * a country name) all return `false`.
 */
export function isValidIanaTimeZone(input: unknown): input is string {
  if (typeof input !== "string" || input.length === 0) return false;
  if (UTC_OFFSET_PATTERN.test(input)) return false;
  try {
    // Defense: do not pass an empty string here either — some
    // implementations historically silently substituted UTC.
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: input });
    return fmt.resolvedOptions().timeZone === input;
  } catch {
    return false;
  }
}

export function assertValidIanaTimeZone(
  input: unknown,
  field = "timeZone",
): asserts input is string {
  if (!isValidIanaTimeZone(input)) {
    throw new Error(
      `${field} "${String(input)}" is not a valid IANA timezone identifier`,
    );
  }
}

function isPositiveFiniteInteger(input: unknown): input is number {
  return (
    typeof input === "number" &&
    Number.isFinite(input) &&
    Number.isInteger(input) &&
    input >= 0
  );
}

export function isValidSchedulingBoundValue(
  key: SchedulingBoundKey,
  value: unknown,
): value is number {
  if (!isPositiveFiniteInteger(value)) return false;
  const bound = SCHEDULING_BOUNDS[key];
  return value >= bound.min && value <= bound.max;
}

export function assertValidSchedulingBoundValue(
  key: SchedulingBoundKey,
  value: unknown,
): asserts value is number {
  if (!isValidSchedulingBoundValue(key, value)) {
    const bound = SCHEDULING_BOUNDS[key];
    throw new Error(
      `${key} must be an integer between ${bound.min} and ${bound.max} (got ${String(value)})`,
    );
  }
}

/** Convenience: validate every owner-supplied scheduling preference at
 * once. Throws on the first failure so the Settings mutation surfaces a
 * clean, specific message rather than a generic "invalid input". */
export type SchedulingPreferences = {
  timeZone: string;
  defaultDurationMinutes: number;
  minLeadTimeMinutes: number;
  maxDaysAhead: number;
  bufferMinutes: number;
};

export function assertValidSchedulingPreferences(
  prefs: SchedulingPreferences,
): void {
  assertValidIanaTimeZone(prefs.timeZone);
  assertValidSchedulingBoundValue(
    "defaultDurationMinutes",
    prefs.defaultDurationMinutes,
  );
  assertValidSchedulingBoundValue(
    "minLeadTimeMinutes",
    prefs.minLeadTimeMinutes,
  );
  assertValidSchedulingBoundValue("maxDaysAhead", prefs.maxDaysAhead);
  assertValidSchedulingBoundValue("bufferMinutes", prefs.bufferMinutes);
}
