/// <reference types="vite/client" />

// Unit and integration tests for the SSRF guard surface in configurationTools.ts.
//
// Coverage targets:
//   - isBlockedHostname: localhost, *.localhost, normal domain pass-through
//   - isBlockedIp: all RFC/category boundary cases
//   - guardedFetchProfileSource: every guard branch (http-only, hostname, DNS IPv4,
//     DNS IPv6, redirect-downgrade, redirect-cap, body-size, content-type, timeout,
//     happy path, userinfo stripping, DNS-rebind SSRF pinning)
//
// No real network egress. All DNS and fetch calls are mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Silence FG_213 console.log instrumentation so test output stays clean.
// ---------------------------------------------------------------------------
vi.spyOn(console, "log").mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Mock node:dns/promises BEFORE importing the module under test.
// The vi.mock call is hoisted by Vitest so it always runs before the import.
// ---------------------------------------------------------------------------
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock undici BEFORE importing the module under test (FG_206).
// guardedFetchProfileSource now uses undici.fetch (not globalThis.fetch) to
// ensure the TCP connection goes to the pre-validated IP rather than
// re-resolving the hostname independently. We mock both:
//   - Agent: captured so the DNS-rebind test can inspect the lookup callback.
//   - fetch: vi.fn() that tests control per-test via mockUndiciFetch.
// ---------------------------------------------------------------------------
let capturedLookupFn: ((hostname: string, opts: unknown, cb: (err: Error | null, address: string, family: number) => void) => void) | null = null;

vi.mock("undici", () => {
  const mockFetch = vi.fn();

  class MockAgent {
    constructor(opts: { connect?: { lookup?: unknown } }) {
      // Capture the lookup callback so the DNS-rebind test can assert it pins
      // to the validated IP rather than re-resolving.
      const lookup = opts?.connect?.lookup;
      if (typeof lookup === "function") {
        capturedLookupFn = lookup as typeof capturedLookupFn;
      }
    }
    destroy() {
      return Promise.resolve();
    }
  }

  return { Agent: MockAgent, fetch: mockFetch };
});

import { lookup } from "node:dns/promises";
import { fetch as mockUndiciFetch } from "undici";
import {
  isBlockedHostname,
  isBlockedIp,
  guardedFetchProfileSource,
  FetchSourceError,
} from "../configurationTools";

// ---------------------------------------------------------------------------
// Typed casts for the mocks so we can call `.mockResolvedValue` etc.
// ---------------------------------------------------------------------------
const mockLookup = lookup as ReturnType<typeof vi.fn>;
const mockFetch = mockUndiciFetch as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers to build a minimal Response-like object.
// ---------------------------------------------------------------------------
function makeTextResponse(
  body: string,
  opts: {
    status?: number;
    contentType?: string;
    headers?: Record<string, string>;
  } = {},
): Response {
  const { status = 200, contentType = "text/html", headers = {} } = opts;
  const allHeaders = new Headers({ "content-type": contentType, ...headers });
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Response(stream, { status, headers: allHeaders });
}

function makeRedirectResponse(location: string, status = 301): Response {
  return new Response(null, {
    status,
    headers: new Headers({ location }),
  });
}

// A response whose body ReadableStream never resolves (simulates a stalled
// connection). We abort via AbortController, which rejects the read with an
// AbortError.
function makeStalledResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(_controller) {
      // intentionally never enqueued/closed — stalls the reader
    },
    cancel() {},
  });
  return new Response(stream, {
    status: 200,
    headers: new Headers({ "content-type": "text/html" }),
  });
}

// ---------------------------------------------------------------------------
// Default DNS mock: returns a single public IPv4 address.
// Tests that need a different DNS outcome override this per-test.
// ---------------------------------------------------------------------------
const PUBLIC_IP = "93.184.216.34"; // example.com
const PUBLIC_DNS_RESULT = [{ address: PUBLIC_IP, family: 4 }];

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
  capturedLookupFn = null;
});

afterEach(() => {
  vi.resetAllMocks();
  capturedLookupFn = null;
});

// ===========================================================================
// isBlockedHostname
// ===========================================================================
describe("isBlockedHostname", () => {
  it("blocks 'localhost' (exact)", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
  });

  it("blocks 'LOCALHOST' (case-insensitive)", () => {
    expect(isBlockedHostname("LOCALHOST")).toBe(true);
  });

  it("blocks '*.localhost' subdomains", () => {
    expect(isBlockedHostname("app.localhost")).toBe(true);
    expect(isBlockedHostname("api.dev.localhost")).toBe(true);
  });

  it("passes a normal public domain", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
  });

  it("passes a domain that ends with 'localhost' as a component but is not .localhost", () => {
    // 'notlocalhost.com' does not end with '.localhost'
    expect(isBlockedHostname("notlocalhost.com")).toBe(false);
  });
});

// ===========================================================================
// isBlockedIp — IPv4
// ===========================================================================
describe("isBlockedIp — IPv4", () => {
  // RFC 1918 private ranges
  it("blocks 10.0.0.1 (RFC 1918 class-A)", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
  });

  it("blocks 172.16.0.1 (RFC 1918 class-B lower boundary)", () => {
    expect(isBlockedIp("172.16.0.1")).toBe(true);
  });

  it("blocks 172.31.255.255 (RFC 1918 class-B upper boundary)", () => {
    expect(isBlockedIp("172.31.255.255")).toBe(true);
  });

  it("passes 172.15.0.1 (just below RFC 1918 class-B)", () => {
    expect(isBlockedIp("172.15.0.1")).toBe(false);
  });

  it("passes 172.32.0.1 (just above RFC 1918 class-B)", () => {
    expect(isBlockedIp("172.32.0.1")).toBe(false);
  });

  it("blocks 192.168.0.1 (RFC 1918 class-C)", () => {
    expect(isBlockedIp("192.168.0.1")).toBe(true);
  });

  // Loopback
  it("blocks 127.0.0.1 (IPv4 loopback)", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
  });

  it("blocks 127.255.255.255 (IPv4 loopback upper boundary)", () => {
    expect(isBlockedIp("127.255.255.255")).toBe(true);
  });

  // Link-local / AWS metadata
  it("blocks 169.254.0.1 (link-local / AWS metadata lower)", () => {
    expect(isBlockedIp("169.254.0.1")).toBe(true);
  });

  it("blocks 169.254.169.254 (AWS IMDSv1 exact)", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true);
  });

  // RFC 6598 CGNAT (FG_210)
  it("blocks 100.64.0.1 (RFC 6598 CGNAT lower boundary)", () => {
    expect(isBlockedIp("100.64.0.1")).toBe(true);
  });

  it("blocks 100.127.255.255 (RFC 6598 CGNAT upper boundary)", () => {
    expect(isBlockedIp("100.127.255.255")).toBe(true);
  });

  it("passes 100.63.0.1 (just below RFC 6598 CGNAT)", () => {
    expect(isBlockedIp("100.63.0.1")).toBe(false);
  });

  it("passes 100.128.0.1 (just above RFC 6598 CGNAT)", () => {
    expect(isBlockedIp("100.128.0.1")).toBe(false);
  });

  // Multicast / reserved
  it("blocks 224.0.0.1 (multicast lower)", () => {
    expect(isBlockedIp("224.0.0.1")).toBe(true);
  });

  it("blocks 255.255.255.255 (broadcast)", () => {
    expect(isBlockedIp("255.255.255.255")).toBe(true);
  });

  // 0.0.0.0
  it("blocks 0.0.0.0", () => {
    expect(isBlockedIp("0.0.0.0")).toBe(true);
  });

  // Happy path
  it("passes 93.184.216.34 (example.com public IP)", () => {
    expect(isBlockedIp("93.184.216.34")).toBe(false);
  });

  it("passes 8.8.8.8 (Google DNS public IP)", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});

// ===========================================================================
// isBlockedIp — IPv6
// ===========================================================================
describe("isBlockedIp — IPv6", () => {
  it("blocks ::1 (IPv6 loopback)", () => {
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("blocks :: (IPv6 unspecified)", () => {
    expect(isBlockedIp("::")).toBe(true);
  });

  // ULA fc/fd
  it("blocks fc00::1 (ULA fc prefix)", () => {
    expect(isBlockedIp("fc00::1")).toBe(true);
  });

  it("blocks fd00::1 (ULA fd prefix)", () => {
    expect(isBlockedIp("fd00::1")).toBe(true);
  });

  // Link-local fe80
  it("blocks fe80::1 (IPv6 link-local)", () => {
    expect(isBlockedIp("fe80::1")).toBe(true);
  });

  it("blocks fe8f::1 (IPv6 link-local fe8x range)", () => {
    expect(isBlockedIp("fe8f::1")).toBe(true);
  });

  it("blocks fe90::1 (IPv6 link-local fe9x range)", () => {
    expect(isBlockedIp("fe90::1")).toBe(true);
  });

  it("blocks fea0::1 (IPv6 link-local feax range)", () => {
    expect(isBlockedIp("fea0::1")).toBe(true);
  });

  it("blocks feb0::1 (IPv6 link-local febx range)", () => {
    expect(isBlockedIp("feb0::1")).toBe(true);
  });

  // Multicast ff
  it("blocks ff02::1 (IPv6 multicast)", () => {
    expect(isBlockedIp("ff02::1")).toBe(true);
  });

  // IPv4-mapped dotted-decimal form (FG_210/FG_211)
  it("blocks ::ffff:127.0.0.1 (IPv4-mapped loopback — dotted form)", () => {
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("blocks ::ffff:10.0.0.1 (IPv4-mapped RFC1918 — dotted form)", () => {
    expect(isBlockedIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("blocks ::ffff:169.254.169.254 (IPv4-mapped AWS metadata — dotted form)", () => {
    expect(isBlockedIp("::ffff:169.254.169.254")).toBe(true);
  });

  // IPv4-mapped hex-group form (FG_211): ::ffff:7f00:0001 == 127.0.0.1
  it("blocks ::ffff:7f00:0001 (IPv4-mapped loopback — hex form)", () => {
    expect(isBlockedIp("::ffff:7f00:0001")).toBe(true);
  });

  // ::ffff:0a00:0001 == 10.0.0.1
  it("blocks ::ffff:0a00:0001 (IPv4-mapped RFC1918 — hex form)", () => {
    expect(isBlockedIp("::ffff:0a00:0001")).toBe(true);
  });

  // Public IPv6 (passes)
  it("passes 2001:db8::1 (documentation/public range)", () => {
    expect(isBlockedIp("2001:db8::1")).toBe(false);
  });
});

// ===========================================================================
// guardedFetchProfileSource — integration tests (DNS + fetch mocked)
// ===========================================================================
describe("guardedFetchProfileSource", () => {
  // -------------------------------------------------------------------------
  // 1. http:// rejected (non-https before DNS)
  //
  // Note: this guard fires BEFORE the try/catch block, so it propagates as
  // a FetchSourceError throw rather than being normalised to an unavailable
  // result object. The tool's execute() wrapper in buildConfigurationTools
  // catches all errors; here we verify the throw shape directly.
  // -------------------------------------------------------------------------
  it("throws FetchSourceError for http:// URLs (non-https)", async () => {
    await expect(
      guardedFetchProfileSource("http://example.com/page"),
    ).rejects.toThrow(FetchSourceError);
    await expect(
      guardedFetchProfileSource("http://example.com/page"),
    ).rejects.toMatchObject({ category: "non_https" });
    // DNS must never be consulted
    expect(mockLookup).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Hostname 'localhost' rejected
  // -------------------------------------------------------------------------
  it("returns unavailable when hostname is 'localhost'", async () => {
    // DNS should never be reached; the hostname guard fires first.
    const result = await guardedFetchProfileSource(
      "https://localhost/secret",
    );
    expect(result.status).toBe("unavailable");
    expect(mockLookup).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. DNS-resolved 10.0.0.1 rejected (RFC1918)
  // -------------------------------------------------------------------------
  it("returns unavailable when DNS resolves to 10.0.0.1 (RFC1918)", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);

    const result = await guardedFetchProfileSource(
      "https://internal.example.com/",
    );
    expect(result.status).toBe("unavailable");
    // fetch must NOT have been called — the DNS guard fires first
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. DNS-resolved ::1 rejected (IPv6 loopback)
  // -------------------------------------------------------------------------
  it("returns unavailable when DNS resolves to ::1 (IPv6 loopback)", async () => {
    mockLookup.mockResolvedValue([{ address: "::1", family: 6 }]);

    const result = await guardedFetchProfileSource(
      "https://ipv6-loopback.example.com/",
    );
    expect(result.status).toBe("unavailable");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. Redirect to http:// mid-chain rejected
  // -------------------------------------------------------------------------
  it("returns unavailable when a redirect points to http:// (non-https downgrade)", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return makeRedirectResponse("http://attacker.example.com/steal");
      }
      return makeTextResponse("should not reach");
    });

    const result = await guardedFetchProfileSource(
      "https://example.com/redirect",
    );
    expect(result.status).toBe("unavailable");
    // Only one fetch call should have been made (the redirect is caught before
    // another fetch is attempted because the new URL is http://)
    expect(callCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 6. 4th redirect (limit + 1) rejected
  // -------------------------------------------------------------------------
  it("returns unavailable when redirect count exceeds PROFILE_SOURCE_MAX_REDIRECTS=3", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    let hopCount = 0;
    mockFetch.mockImplementation(async () => {
      hopCount++;
      // Always redirect — the 4th hop (hop===3 in 0-indexed loop) should
      // trigger the redirect_cap guard.
      return makeRedirectResponse(`https://example.com/hop${hopCount}`);
    });

    const result = await guardedFetchProfileSource(
      "https://example.com/start",
    );
    expect(result.status).toBe("unavailable");
    // MAX_REDIRECTS = 3, so we get hops 0,1,2,3 — 4 fetch calls total
    // before redirect_cap fires.
    expect(hopCount).toBe(4);
  });

  // -------------------------------------------------------------------------
  // 7. 2 MB response body rejected (body size cap 1 MB)
  // -------------------------------------------------------------------------
  it("returns unavailable when response body exceeds 1 MB", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);

    const OVER_1MB = 1024 * 1024 + 1;
    const bigBody = "x".repeat(OVER_1MB);
    mockFetch.mockResolvedValue(
      makeTextResponse(bigBody, { contentType: "text/plain" }),
    );

    const result = await guardedFetchProfileSource("https://example.com/big");
    expect(result.status).toBe("unavailable");
    expect((result as { reason?: string }).reason).toMatch(/too large/i);
  });

  // -------------------------------------------------------------------------
  // 8. content-type image/png rejected
  // -------------------------------------------------------------------------
  it("returns unavailable for content-type image/png", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    mockFetch.mockResolvedValue(
      makeTextResponse("PNG_DATA", { contentType: "image/png" }),
    );

    const result = await guardedFetchProfileSource(
      "https://example.com/avatar.png",
    );
    expect(result.status).toBe("unavailable");
    expect((result as { reason?: string }).reason).toMatch(
      /unsupported content type/i,
    );
  });

  // -------------------------------------------------------------------------
  // 9. Never-resolving fetch → AbortError → unavailable
  //
  // The guard uses an AbortController wired to a 5 s setTimeout. We mock
  // fetch to return a promise that never resolves but rejects with an
  // AbortError when the signal fires. Then we advance fake timers to trigger
  // the abort, which causes the catch to normalise the AbortError to
  // { status: "unavailable" }.
  // -------------------------------------------------------------------------
  it("returns unavailable when fetch is aborted (timeout path)", async () => {
    vi.useFakeTimers();
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);

    mockFetch.mockImplementation(async (_url: unknown, init?: { signal?: AbortSignal }) => {
      const signal = init?.signal as AbortSignal | undefined;
      // Return a promise that never resolves but aborts when the signal fires.
      return new Promise<Response>((_, reject) => {
        if (signal?.aborted) {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
          return;
        }
        signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
        // Never resolve — simulates a hung connection
      });
    });

    const fetchPromise = guardedFetchProfileSource(
      "https://example.com/stalled",
    );
    // Advance timers to fire the 5 s AbortController timeout
    await vi.runAllTimersAsync();
    const result = await fetchPromise;

    expect(result.status).toBe("unavailable");
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 10. Happy path: https + public IP + text/html returns available
  // -------------------------------------------------------------------------
  it("returns available for a valid https URL with public IP and text/html body", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    const htmlBody = "<html><body><p>Hello world</p></body></html>";
    mockFetch.mockResolvedValue(
      makeTextResponse(htmlBody, { contentType: "text/html" }),
    );

    const result = await guardedFetchProfileSource("https://example.com/");
    expect(result.status).toBe("available");
    // extractText strips tags; the text must contain meaningful words
    expect((result as { text?: string }).text).toContain("Hello world");
    expect((result as { contentType?: string }).contentType).toBe("text/html");
  });

  // -------------------------------------------------------------------------
  // 11. Happy path: application/json content-type passes
  // -------------------------------------------------------------------------
  it("returns available for application/json content-type", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    const jsonBody = JSON.stringify({ name: "Alice" });
    mockFetch.mockResolvedValue(
      makeTextResponse(jsonBody, { contentType: "application/json" }),
    );

    const result = await guardedFetchProfileSource(
      "https://api.example.com/profile.json",
    );
    expect(result.status).toBe("available");
  });

  // -------------------------------------------------------------------------
  // 12. Userinfo stripping: credentials in the URL must NOT reach fetch
  // -------------------------------------------------------------------------
  it("strips userinfo before passing URL to fetch (FG_212)", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    const capturedUrls: string[] = [];
    mockFetch.mockImplementation(async (url: string | URL) => {
      capturedUrls.push(typeof url === "string" ? url : url.toString());
      return makeTextResponse("ok", { contentType: "text/plain" });
    });

    await guardedFetchProfileSource(
      "https://user:secret@example.com/profile",
    );

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).not.toContain("user");
    expect(capturedUrls[0]).not.toContain("secret");
    expect(capturedUrls[0]).toContain("example.com/profile");
  });

  // -------------------------------------------------------------------------
  // 13. Redirect chain of 2 hops succeeds (within the 3-hop limit)
  // -------------------------------------------------------------------------
  it("follows up to 2 redirects and returns available", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    let hopCount = 0;
    mockFetch.mockImplementation(async () => {
      hopCount++;
      if (hopCount < 3) {
        return makeRedirectResponse(
          `https://example.com/redirect${hopCount}`,
        );
      }
      return makeTextResponse("final page", { contentType: "text/plain" });
    });

    const result = await guardedFetchProfileSource(
      "https://example.com/start",
    );
    expect(result.status).toBe("available");
    expect(hopCount).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 14. Non-200 HTTP response returns unavailable (graceful, not a throw)
  // -------------------------------------------------------------------------
  it("returns unavailable for HTTP 404 response without throwing", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    mockFetch.mockResolvedValue(
      makeTextResponse("Not Found", { status: 404, contentType: "text/html" }),
    );

    const result = await guardedFetchProfileSource(
      "https://example.com/missing",
    );
    expect(result.status).toBe("unavailable");
    expect((result as { reason?: string }).reason).toMatch(/404/);
  });

  // -------------------------------------------------------------------------
  // 15. content-type with charset parameter is correctly parsed
  // -------------------------------------------------------------------------
  it("accepts text/html;charset=utf-8 as a valid content-type", async () => {
    mockLookup.mockResolvedValue(PUBLIC_DNS_RESULT);
    mockFetch.mockResolvedValue(
      makeTextResponse("<p>Hi</p>", {
        contentType: "text/html;charset=utf-8",
      }),
    );

    const result = await guardedFetchProfileSource("https://example.com/");
    expect(result.status).toBe("available");
  });

  // -------------------------------------------------------------------------
  // 16. DNS-rebind SSRF pinning (FG_206)
  //
  // The attacker controls a DNS record with TTL 0. On the first lookup
  // (safety check) it returns a public IP; on the second lookup (if fetch
  // were to re-resolve independently) it returns 169.254.169.254.
  //
  // With the Undici dispatcher approach, there IS no second DNS resolution —
  // the connection is pinned to the IP returned by the first (validated)
  // lookup. We assert this by inspecting the IP passed to the Undici Agent's
  // connect.lookup callback, which must be the public IP from the first
  // lookup, NOT the private IP the attacker would serve on a re-resolution.
  // -------------------------------------------------------------------------
  it("pins TCP connection to the validated IP, not a rebounded private IP (FG_206)", async () => {
    const FIRST_LOOKUP_IP = "93.184.216.34";  // public IP — passes safety check
    const SECOND_LOOKUP_IP = "169.254.169.254"; // AWS metadata — would be blocked

    let lookupCallCount = 0;
    mockLookup.mockImplementation(() => {
      lookupCallCount++;
      if (lookupCallCount === 1) {
        // First call: safety check — return public IP
        return Promise.resolve([{ address: FIRST_LOOKUP_IP, family: 4 }]);
      }
      // Second call (would happen if fetch re-resolves): return private IP
      return Promise.resolve([{ address: SECOND_LOOKUP_IP, family: 4 }]);
    });

    mockFetch.mockResolvedValue(
      makeTextResponse("<p>hello</p>", { contentType: "text/html" }),
    );

    capturedLookupFn = null;
    const result = await guardedFetchProfileSource("https://example.com/");

    // The fetch succeeded (the pinned public IP is used, not the rebounded one)
    expect(result.status).toBe("available");

    // The Undici Agent's connect.lookup callback was installed with a pinned IP.
    // Invoke it synchronously to prove it always resolves to the FIRST lookup
    // IP, regardless of what DNS would return on a second resolution.
    expect(capturedLookupFn).not.toBeNull();
    const resolvedAddress = await new Promise<string>((resolve, reject) => {
      capturedLookupFn!("example.com", {}, (err, address) => {
        if (err) reject(err);
        else resolve(address);
      });
    });

    expect(resolvedAddress).toBe(FIRST_LOOKUP_IP);
    expect(resolvedAddress).not.toBe(SECOND_LOOKUP_IP);

    // Only ONE DNS lookup should have occurred — the safety check.
    // (The undici dispatcher skips re-resolution entirely.)
    expect(lookupCallCount).toBe(1);
  });
});
