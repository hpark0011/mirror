// Google Calendar API client seam.
//
// Production actions construct a real client via `createGoogleCalendarClient`,
// which is backed by `fetch` against the v3 REST API. Tests inject a fake
// implementation through an action-level factory rather than via a
// production `if (testMode)` branch — keeping the test seam at the
// interface boundary means production code never carries a test-only
// path. See the plan: "Avoid production branches keyed on a test env var.
// The fake should replace the client at the action boundary in tests."
//
// Pure module: no Convex runtime imports. Safe to import from any
// Convex action or unit test.

export type FreeBusyRequest = {
  /** Inclusive RFC3339 start of the window to check. */
  timeMinIso: string;
  /** Exclusive RFC3339 end of the window to check. */
  timeMaxIso: string;
  /** IANA timezone the request frame is expressed in. */
  timeZone: string;
  /** Calendar ids to query — `["primary"]` for the signed-in user. */
  calendarIds: string[];
};

export type FreeBusyBusyRange = {
  startIso: string;
  endIso: string;
};

export type FreeBusyResponse = {
  /** Keyed by calendar id; the array is empty when the calendar is free
   * for the requested window. */
  calendars: Record<string, { busy: FreeBusyBusyRange[] }>;
};

type GoogleFreeBusyCalendarError = {
  domain?: string;
  reason?: string;
};

export type InsertEventAttendee = {
  email: string;
  displayName?: string;
};

export type InsertEventConferenceData = {
  /** Stable id derived from the meeting's idempotency key so retries of
   * the same logical event do not create a second Meet conference. */
  requestId: string;
};

export type InsertEventRequest = {
  calendarId: string;
  /** Whether to send invitation emails. We pass `"all"` so the attendee
   * gets a calendar invite without needing to log in to see it. */
  sendUpdates: "all" | "externalOnly" | "none";
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: InsertEventAttendee[];
  /** Set only when the owner enabled Google Meet on this connection. */
  conferenceData?: InsertEventConferenceData;
};

export type InsertEventResponse = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
};

/**
 * Normalized error from any Google Calendar call. Production code maps
 * provider errors here so callers can switch on `kind` without inspecting
 * raw HTTP status codes or response bodies (which may leak PII into
 * Sentry — production logging upstream of this module must scrub the
 * `raw` field if present).
 */
export type GoogleCalendarErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "conflict"
  | "network"
  | "unknown";

export class GoogleCalendarError extends Error {
  readonly kind: GoogleCalendarErrorKind;
  readonly status?: number;

  constructor(
    kind: GoogleCalendarErrorKind,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "GoogleCalendarError";
    this.kind = kind;
    this.status = status;
  }
}

export interface GoogleCalendarClient {
  freeBusy(request: FreeBusyRequest): Promise<FreeBusyResponse>;
  insertEvent(request: InsertEventRequest): Promise<InsertEventResponse>;
}

const GOOGLE_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Production `fetch`-backed factory. The Convex Node action constructs
 * one of these per request after resolving the owner's access token
 * through Better Auth. The token never leaves the closure — it is not
 * stored on the returned object beyond the method bodies.
 */
export function createGoogleCalendarClient(
  accessToken: string,
  options: { fetchImpl?: typeof fetch } = {},
): GoogleCalendarClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const authHeader = `Bearer ${accessToken}`;

  return {
    async freeBusy({ timeMinIso, timeMaxIso, timeZone, calendarIds }) {
      const response = await fetchImpl(`${GOOGLE_API_BASE}/freeBusy`, {
        method: "POST",
        headers: {
          authorization: authHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          timeMin: timeMinIso,
          timeMax: timeMaxIso,
          timeZone,
          items: calendarIds.map((id) => ({ id })),
        }),
      });
      if (!response.ok) {
        throw await readGoogleError(response);
      }
      const json = (await response.json()) as {
        calendars?: Record<
          string,
          {
            busy?: Array<{ start: string; end: string }>;
            errors?: GoogleFreeBusyCalendarError[];
          }
        >;
      };
      const calendars: FreeBusyResponse["calendars"] = {};
      for (const id of calendarIds) {
        const calendar = json.calendars?.[id];
        const error = calendar?.errors?.[0];
        if (error) {
          throw new GoogleCalendarError(
            freeBusyErrorKind(error),
            freeBusyErrorMessage(error),
          );
        }
        const busyRanges = calendar?.busy ?? [];
        calendars[id] = {
          busy: busyRanges.map((b) => ({
            startIso: b.start,
            endIso: b.end,
          })),
        };
      }
      return { calendars };
    },

    async insertEvent({
      calendarId,
      sendUpdates,
      conferenceData,
      ...event
    }) {
      const params = new URLSearchParams({ sendUpdates });
      const conferenceDataVersion = conferenceData ? 1 : 0;
      if (conferenceData) {
        params.set("conferenceDataVersion", String(conferenceDataVersion));
      }
      const body: Record<string, unknown> = {
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: event.attendees.map((a) => {
          const entry: Record<string, unknown> = { email: a.email };
          if (a.displayName) entry.displayName = a.displayName;
          return entry;
        }),
      };
      if (conferenceData) {
        body.conferenceData = {
          createRequest: {
            requestId: conferenceData.requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }
      const url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(
        calendarId,
      )}/events?${params.toString()}`;
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: authHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw await readGoogleError(response);
      }
      const json = (await response.json()) as {
        id?: string;
        htmlLink?: string;
        hangoutLink?: string;
      };
      if (!json.id) {
        throw new GoogleCalendarError(
          "unknown",
          "Google Calendar event response missing id",
        );
      }
      return {
        id: json.id,
        ...(json.htmlLink ? { htmlLink: json.htmlLink } : {}),
        ...(json.hangoutLink ? { hangoutLink: json.hangoutLink } : {}),
      };
    },
  };
}

function freeBusyErrorKind(
  error: GoogleFreeBusyCalendarError,
): GoogleCalendarErrorKind {
  const reason = error.reason ?? "";
  if (reason === "notFound") return "not_found";
  if (reason === "forbidden") return "forbidden";
  if (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded") {
    return "rate_limited";
  }
  if (reason === "internalError") return "network";
  return "unknown";
}

function freeBusyErrorMessage(error: GoogleFreeBusyCalendarError): string {
  return error.reason
    ? `Google Calendar free/busy failed: ${error.reason}`
    : "Google Calendar free/busy failed";
}

async function readGoogleError(
  response: Response,
): Promise<GoogleCalendarError> {
  // Read the body so the status mapping has something to surface, but
  // never include it in the public error message — Google response
  // bodies can contain attendee email and other PII. Upstream logging is
  // responsible for any redacted capture of the raw body.
  let message = `Google Calendar request failed with HTTP ${response.status}`;
  try {
    await response.text();
  } catch {
    // ignore body read failures — we still throw on status
  }
  const status = response.status;
  const kind: GoogleCalendarErrorKind =
    status === 401
      ? "unauthorized"
      : status === 403
        ? "forbidden"
        : status === 404
          ? "not_found"
          : status === 409
            ? "conflict"
            : status === 429
              ? "rate_limited"
              : status >= 500
                ? "network"
                : "unknown";
  return new GoogleCalendarError(kind, message, status);
}

/**
 * Test-fake helper. Tests build a `GoogleCalendarClient` from a partial
 * implementation; any method left unimplemented throws so a missing fake
 * is loud rather than silent. Use from `__tests__` only — the production
 * action factory should never reach for this.
 */
export function createFakeGoogleCalendarClient(
  overrides: Partial<GoogleCalendarClient>,
): GoogleCalendarClient {
  return {
    freeBusy:
      overrides.freeBusy ??
      (async () => {
        throw new Error("createFakeGoogleCalendarClient: freeBusy not stubbed");
      }),
    insertEvent:
      overrides.insertEvent ??
      (async () => {
        throw new Error(
          "createFakeGoogleCalendarClient: insertEvent not stubbed",
        );
      }),
  };
}
