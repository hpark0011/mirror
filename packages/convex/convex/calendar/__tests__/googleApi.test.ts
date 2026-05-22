import { describe, expect, it } from "vitest";
import {
  GoogleCalendarError,
  createFakeGoogleCalendarClient,
  createGoogleCalendarClient,
  type FreeBusyResponse,
  type InsertEventRequest,
  type InsertEventResponse,
} from "../googleApi";

describe("createGoogleCalendarClient.freeBusy", () => {
  it("issues a POST to /freeBusy with the access token", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(
        JSON.stringify({
          calendars: {
            primary: { busy: [{ start: "a", end: "b" }] },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = createGoogleCalendarClient("ya29.test-token", {
      fetchImpl,
    });
    const result = await client.freeBusy({
      timeMinIso: "2026-05-22T15:00:00-07:00",
      timeMaxIso: "2026-05-22T16:00:00-07:00",
      timeZone: "America/Los_Angeles",
      calendarIds: ["primary"],
    });
    expect(captured.url).toBe(
      "https://www.googleapis.com/calendar/v3/freeBusy",
    );
    expect(captured.init?.method).toBe("POST");
    const headers = (captured.init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe("Bearer ya29.test-token");
    const body = JSON.parse(String(captured.init?.body));
    expect(body.items).toEqual([{ id: "primary" }]);
    expect(result.calendars.primary?.busy).toEqual([
      { startIso: "a", endIso: "b" },
    ]);
  });

  it("returns an empty busy array when the API omits the calendar", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ calendars: {} }), { status: 200 });
    const client = createGoogleCalendarClient("token", { fetchImpl });
    const result: FreeBusyResponse = await client.freeBusy({
      timeMinIso: "2026-05-22T00:00:00Z",
      timeMaxIso: "2026-05-23T00:00:00Z",
      timeZone: "UTC",
      calendarIds: ["primary"],
    });
    expect(result.calendars.primary).toEqual({ busy: [] });
  });

  it("maps 401 to GoogleCalendarError kind=unauthorized", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("nope", { status: 401 });
    const client = createGoogleCalendarClient("token", { fetchImpl });
    await expect(
      client.freeBusy({
        timeMinIso: "2026-05-22T00:00:00Z",
        timeMaxIso: "2026-05-23T00:00:00Z",
        timeZone: "UTC",
        calendarIds: ["primary"],
      }),
    ).rejects.toMatchObject({
      name: "GoogleCalendarError",
      kind: "unauthorized",
      status: 401,
    });
  });

  it("throws when a 200 response includes per-calendar free/busy errors", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          calendars: {
            primary: {
              busy: [],
              errors: [{ domain: "global", reason: "notFound" }],
            },
          },
        }),
        { status: 200 },
      );
    const client = createGoogleCalendarClient("token", { fetchImpl });
    await expect(
      client.freeBusy({
        timeMinIso: "2026-05-22T00:00:00Z",
        timeMaxIso: "2026-05-23T00:00:00Z",
        timeZone: "UTC",
        calendarIds: ["primary"],
      }),
    ).rejects.toMatchObject({
      name: "GoogleCalendarError",
      kind: "not_found",
    });
  });
});

describe("createGoogleCalendarClient.insertEvent", () => {
  const baseRequest: InsertEventRequest = {
    calendarId: "primary",
    sendUpdates: "all",
    summary: "Meeting with Visitor",
    description: "Scheduled through Grey Mirror chat",
    start: {
      dateTime: "2026-05-22T15:00:00-07:00",
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: "2026-05-22T15:30:00-07:00",
      timeZone: "America/Los_Angeles",
    },
    attendees: [{ email: "visitor@example.com", displayName: "Visitor" }],
  };

  it("posts to /calendars/{id}/events with sendUpdates", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      const response: InsertEventResponse = {
        id: "event-xyz",
        htmlLink: "https://calendar.google.com/event?eid=...",
      };
      return new Response(JSON.stringify(response), { status: 200 });
    };
    const client = createGoogleCalendarClient("token", { fetchImpl });
    const result = await client.insertEvent(baseRequest);
    expect(captured.url).toContain(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?",
    );
    expect(captured.url).toContain("sendUpdates=all");
    expect(captured.url).not.toContain("conferenceDataVersion");
    const body = JSON.parse(String(captured.init?.body));
    expect(body.attendees).toEqual([
      { email: "visitor@example.com", displayName: "Visitor" },
    ]);
    expect(body.conferenceData).toBeUndefined();
    expect(result.id).toBe("event-xyz");
  });

  it("adds conferenceDataVersion=1 and a deterministic Meet requestId", async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(
        JSON.stringify({
          id: "event-xyz",
          hangoutLink: "https://meet.google.com/abc-defg-hij",
        }),
        { status: 200 },
      );
    };
    const client = createGoogleCalendarClient("token", { fetchImpl });
    await client.insertEvent({
      ...baseRequest,
      conferenceData: { requestId: "idem-hash-12345" },
    });
    expect(captured.url).toContain("conferenceDataVersion=1");
    const body = JSON.parse(String(captured.init?.body));
    expect(body.conferenceData).toEqual({
      createRequest: {
        requestId: "idem-hash-12345",
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    });
  });

  it("omits displayName when not supplied", async () => {
    let captured: { init?: RequestInit } = {};
    const fetchImpl: typeof fetch = async (_, init) => {
      captured = { init };
      return new Response(JSON.stringify({ id: "event-xyz" }), { status: 200 });
    };
    const client = createGoogleCalendarClient("token", { fetchImpl });
    await client.insertEvent({
      ...baseRequest,
      attendees: [{ email: "visitor@example.com" }],
    });
    const body = JSON.parse(String(captured.init?.body));
    expect(body.attendees).toEqual([{ email: "visitor@example.com" }]);
  });

  it("maps 429 to GoogleCalendarError kind=rate_limited", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("rate", { status: 429 });
    const client = createGoogleCalendarClient("token", { fetchImpl });
    await expect(client.insertEvent(baseRequest)).rejects.toMatchObject({
      name: "GoogleCalendarError",
      kind: "rate_limited",
    });
  });
});

describe("createFakeGoogleCalendarClient", () => {
  it("delegates to overrides", async () => {
    const fake = createFakeGoogleCalendarClient({
      freeBusy: async () => ({ calendars: { primary: { busy: [] } } }),
      insertEvent: async () => ({ id: "stub-event" }),
    });
    const fb = await fake.freeBusy({
      timeMinIso: "x",
      timeMaxIso: "y",
      timeZone: "UTC",
      calendarIds: ["primary"],
    });
    expect(fb.calendars.primary).toEqual({ busy: [] });
    const ev = await fake.insertEvent({
      calendarId: "primary",
      sendUpdates: "none",
      summary: "s",
      description: "d",
      start: { dateTime: "2026-05-22T00:00:00Z", timeZone: "UTC" },
      end: { dateTime: "2026-05-22T00:30:00Z", timeZone: "UTC" },
      attendees: [],
    });
    expect(ev.id).toBe("stub-event");
  });

  it("throws loudly when a method is not stubbed", async () => {
    const fake = createFakeGoogleCalendarClient({});
    await expect(
      fake.freeBusy({
        timeMinIso: "x",
        timeMaxIso: "y",
        timeZone: "UTC",
        calendarIds: ["primary"],
      }),
    ).rejects.toThrow(/freeBusy not stubbed/);
  });
});

describe("GoogleCalendarError", () => {
  it("preserves kind and status fields", () => {
    const err = new GoogleCalendarError("forbidden", "no", 403);
    expect(err.kind).toBe("forbidden");
    expect(err.status).toBe(403);
    expect(err.name).toBe("GoogleCalendarError");
  });
});
