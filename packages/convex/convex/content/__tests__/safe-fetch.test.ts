import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:dns/promises BEFORE importing safe-fetch.
const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

const fetchMock = vi.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  lookupMock.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

import {
  FETCH_PER_HOP_TIMEOUT_MS,
  FETCH_TIMEOUT_MS,
  safeFetchImage,
  SafeFetchError,
} from "../safe-fetch";
import { MAX_FETCH_REDIRECTS, MAX_INLINE_IMAGE_BYTES } from "../storage-policy";

function publicLookup() {
  return [{ address: "93.184.216.34", family: 4 }];
}

// 8-byte PNG signature per RFC 2083.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// JPEG SOI + first marker byte (FF D8 FF).
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
// RIFF<4 size bytes>WEBP — 12 bytes total.
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function makePngBytes(byteLength: number): Uint8Array {
  const body = new Uint8Array(byteLength);
  for (let i = 0; i < PNG_MAGIC.length && i < byteLength; i++) {
    body[i] = PNG_MAGIC[i]!;
  }
  return body;
}

function makeJpegBytes(byteLength: number): Uint8Array {
  const body = new Uint8Array(byteLength);
  for (let i = 0; i < JPEG_MAGIC.length && i < byteLength; i++) {
    body[i] = JPEG_MAGIC[i]!;
  }
  return body;
}

function makeWebpBytes(byteLength: number): Uint8Array {
  const body = new Uint8Array(byteLength);
  for (let i = 0; i < WEBP_MAGIC.length && i < byteLength; i++) {
    body[i] = WEBP_MAGIC[i]!;
  }
  return body;
}

function makePngResponse(byteLength: number) {
  return new Response(makePngBytes(byteLength), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(byteLength),
    },
  });
}

describe("safeFetchImage — scheme & DNS", () => {
  it("rejects http:// URLs", async () => {
    await expect(
      safeFetchImage("http://example.com/image.png"),
    ).rejects.toMatchObject({
      name: "SafeFetchError",
      code: "invalid-scheme",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects URLs that resolve to 127.0.0.1 (loopback)", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      safeFetchImage("https://attacker.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects URLs that resolve to 10.0.0.1 (RFC1918)", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    await expect(
      safeFetchImage("https://attacker.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
  });

  it("rejects URLs that resolve to ::1 (IPv6 loopback)", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "::1", family: 6 }]);
    await expect(
      safeFetchImage("https://attacker.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
  });

  it("rejects URLs that resolve to fd00::/7 (IPv6 ULA)", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "fd12:3456:789a::1", family: 6 },
    ]);
    await expect(
      safeFetchImage("https://attacker.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
  });

  // FG_103: compressed-hex IPv4-mapped form must be parsed the same as the
  // dotted-decimal form. ::ffff:7f00:1 == ::ffff:127.0.0.1 (loopback).
  it("rejects URLs that resolve to ::ffff:7f00:1 (IPv4-mapped loopback, hex form)", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "::ffff:7f00:1", family: 6 },
    ]);
    await expect(
      safeFetchImage("https://attacker.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // FG_103: ::ffff:c0a8:0001 == ::ffff:192.168.0.1 (RFC1918 private).
  it("rejects URLs that resolve to ::ffff:c0a8:0001 (IPv4-mapped RFC1918, hex form)", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "::ffff:c0a8:0001", family: 6 },
    ]);
    await expect(
      safeFetchImage("https://attacker.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // FG_103: ::ffff:0808:0808 == ::ffff:8.8.8.8 (public). Must NOT be blocked
  // — proves the hex parser doesn't over-match and false-positive public IPs.
  it("allows URLs that resolve to ::ffff:0808:0808 (IPv4-mapped public, hex form)", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "::ffff:0808:0808", family: 6 },
    ]);
    fetchMock.mockResolvedValueOnce(makePngResponse(16));
    const blob = await safeFetchImage("https://public.example.com/x.png");
    expect(blob.type).toBe("image/png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects URLs that resolve to 169.254.x.x (link-local)", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      safeFetchImage("https://metadata.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
  });

  // Spec NFR-01: literal-IP and `localhost` URLs must be rejected at the
  // DNS-blocklist gate, not just hostname-aliased URLs. These tests pin the
  // exact attacker shapes the spec calls out.
  it("rejects https://localhost/x.png (literal localhost)", async () => {
    lookupMock.mockImplementation(async (host: string) => {
      if (host === "localhost") {
        return [{ address: "127.0.0.1", family: 4 }];
      }
      throw new Error(`unexpected lookup for ${host}`);
    });
    await expect(
      safeFetchImage("https://localhost/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects https://127.0.0.1/x.png (literal IPv4 loopback)", async () => {
    lookupMock.mockImplementation(async (host: string) => {
      if (host === "127.0.0.1") {
        return [{ address: "127.0.0.1", family: 4 }];
      }
      throw new Error(`unexpected lookup for ${host}`);
    });
    await expect(
      safeFetchImage("https://127.0.0.1/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects https://10.0.0.1/x.png (literal RFC1918)", async () => {
    lookupMock.mockImplementation(async (host: string) => {
      if (host === "10.0.0.1") {
        return [{ address: "10.0.0.1", family: 4 }];
      }
      throw new Error(`unexpected lookup for ${host}`);
    });
    await expect(
      safeFetchImage("https://10.0.0.1/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // This one specifically exercises the bracket-strip code in
  // assertHostnameNotBlocked: `URL("https://[::1]/x").hostname` is `"[::1]"`,
  // and `dns.lookup` rejects bracketed hosts. The mock is keyed on the
  // unbracketed `"::1"` to prove the strip happened before the lookup.
  it("rejects https://[::1]/x.png (literal IPv6 loopback, bracket-stripped)", async () => {
    lookupMock.mockImplementation(async (host: string) => {
      if (host === "::1") {
        return [{ address: "::1", family: 6 }];
      }
      throw new Error(`unexpected lookup for ${host} (bracket strip failed?)`);
    });
    await expect(
      safeFetchImage("https://[::1]/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("safeFetchImage — redirects", () => {
  it("re-resolves DNS on each redirect hop and rejects when a hop lands on private IP", async () => {
    // Hop 0: public IP. Hop 1 (after redirect): private IP.
    lookupMock
      .mockResolvedValueOnce(publicLookup())
      .mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);

    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://internal.example.com/x.png" },
      }),
    );

    await expect(
      safeFetchImage("https://public.example.com/x.png"),
    ).rejects.toMatchObject({ code: "blocked-ip" });

    expect(lookupMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when redirect chain exceeds MAX_FETCH_REDIRECTS (3)", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    // 4 redirects in a row — should overflow at the 4th attempt.
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://a.example.com/2" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://a.example.com/3" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://a.example.com/4" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://a.example.com/5" },
        }),
      );

    await expect(
      safeFetchImage("https://a.example.com/1"),
    ).rejects.toMatchObject({ code: "redirect-overflow" });
    // Pins the boundary at MAX_FETCH_REDIRECTS = 3: hops 0, 1, 2, 3 all
    // dispatch a fetch (4 total); the 4th redirect target is rejected
    // before a 5th fetch is issued. Fails if the cap drifts to 2 or 4.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects when redirect response is missing Location header", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302 }));
    await expect(
      safeFetchImage("https://a.example.com/x.png"),
    ).rejects.toMatchObject({ code: "missing-redirect-location" });
  });
});

describe("safeFetchImage — size limits", () => {
  it("rejects when Content-Length exceeds MAX_INLINE_IMAGE_BYTES", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(0), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(MAX_INLINE_IMAGE_BYTES + 1),
        },
      }),
    );
    await expect(
      safeFetchImage("https://example.com/big.png"),
    ).rejects.toMatchObject({ code: "size-limit" });
  });

  it("aborts when streamed bytes exceed limit even with no Content-Length", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    // Build a streamed response that never sets Content-Length but emits
    // chunks summing > MAX_INLINE_IMAGE_BYTES.
    const chunkSize = 1024 * 1024; // 1 MiB
    const chunkCount = 6; // 6 MiB total
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < chunkCount; i++) {
          controller.enqueue(new Uint8Array(chunkSize));
        }
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    await expect(
      safeFetchImage("https://example.com/streamed.png"),
    ).rejects.toMatchObject({ code: "size-limit" });
  });
});

describe("safeFetchImage — content-type", () => {
  it("rejects content-type image/gif", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(8), {
        status: 200,
        headers: { "content-type": "image/gif" },
      }),
    );
    await expect(
      safeFetchImage("https://example.com/anim.gif"),
    ).rejects.toMatchObject({ code: "content-type" });
  });

  it("rejects missing content-type", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(8), { status: 200 }),
    );
    await expect(
      safeFetchImage("https://example.com/blob"),
    ).rejects.toMatchObject({ code: "content-type" });
  });

  it("strips charset parameter and accepts image/png; charset=utf-8", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(makePngBytes(8), {
        status: 200,
        headers: {
          "content-type": "image/png; charset=binary",
          "content-length": "8",
        },
      }),
    );
    const blob = await safeFetchImage("https://example.com/x.png");
    expect(blob.type).toBe("image/png");
  });
});

describe("safeFetchImage — happy path", () => {
  it("returns a Blob for a 4 MiB PNG", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    const size = 4 * 1024 * 1024;
    fetchMock.mockResolvedValueOnce(makePngResponse(size));
    const blob = await safeFetchImage("https://example.com/photo.png");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(size);
  });

  it("accepts image/jpeg and image/webp", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(makeJpegBytes(16), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "16" },
      }),
    );
    const jpeg = await safeFetchImage("https://example.com/a.jpg");
    expect(jpeg.type).toBe("image/jpeg");

    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(makeWebpBytes(16), {
        status: 200,
        headers: { "content-type": "image/webp", "content-length": "16" },
      }),
    );
    const webp = await safeFetchImage("https://example.com/a.webp");
    expect(webp.type).toBe("image/webp");
  });
});

describe("safeFetchImage — magic bytes (FG_110)", () => {
  it("rejects HTML bytes served as image/png", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    const html = new TextEncoder().encode("<!DOCTYPE html><script>alert(1)");
    fetchMock.mockResolvedValueOnce(
      new Response(html, {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(html.byteLength),
        },
      }),
    );
    await expect(
      safeFetchImage("https://attacker.example.com/payload.html"),
    ).rejects.toMatchObject({
      name: "SafeFetchError",
      code: "invalid-magic-bytes",
    });
  });

  it("rejects PNG bytes served as image/jpeg", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(makePngBytes(16), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "16" },
      }),
    );
    await expect(
      safeFetchImage("https://example.com/mismatch.jpg"),
    ).rejects.toMatchObject({ code: "invalid-magic-bytes" });
  });

  it("rejects empty body served as image/png", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(0), {
        status: 200,
        headers: { "content-type": "image/png", "content-length": "0" },
      }),
    );
    await expect(
      safeFetchImage("https://example.com/empty.png"),
    ).rejects.toMatchObject({ code: "invalid-magic-bytes" });
  });
});

describe("safeFetchImage — errors", () => {
  it("times out when fetch is aborted", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        if (signal) {
          if (signal.aborted) {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
            return;
          }
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });
    vi.useFakeTimers();
    const promise = safeFetchImage("https://example.com/slow.png");
    // Attach a no-op rejection handler synchronously to avoid an
    // "unhandled rejection" while we advance the fake clock.
    const guarded = promise.catch((e) => e);
    await vi.advanceTimersByTimeAsync(11_000);
    const err = await guarded;
    expect(err).toBeInstanceOf(SafeFetchError);
    expect(err).toMatchObject({ code: "timeout" });
  });

  it("propagates HTTP errors as http-error", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await expect(
      safeFetchImage("https://example.com/missing.png"),
    ).rejects.toMatchObject({ code: "http-error" });
  });

  it("propagates DNS lookup failure as dns-failure", async () => {
    lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    await expect(
      safeFetchImage("https://nonexistent.invalid/x.png"),
    ).rejects.toMatchObject({ code: "dns-failure" });
  });
});

// FG_109: per-hop timeout in addition to global budget.
//
// The pre-FG_109 implementation used a single AbortController whose 10s
// timer started before the redirect loop. A slow first hop responding
// near the global timeout left only the leftover budget for subsequent
// hops + body read. Per-hop timer resets the inner deadline on each hop
// while the global timer remains the outer cap.
describe("safeFetchImage — per-hop timeout (FG_109)", () => {
  it("FETCH_PER_HOP_TIMEOUT_MS divides the global budget across all hops", () => {
    // Pins the formula so a future change to MAX_FETCH_REDIRECTS or the
    // global timeout has to acknowledge the per-hop relationship.
    expect(FETCH_PER_HOP_TIMEOUT_MS).toBe(
      Math.floor(FETCH_TIMEOUT_MS / (MAX_FETCH_REDIRECTS + 1)),
    );
    // Sanity: per-hop strictly less than global, i.e. it can actually
    // fire before the global timer.
    expect(FETCH_PER_HOP_TIMEOUT_MS).toBeLessThan(FETCH_TIMEOUT_MS);
  });

  it("aborts a slow hop on the per-hop timer before the global budget elapses", async () => {
    lookupMock.mockResolvedValue(publicLookup());
    // Fetch never resolves on its own — only the abort signal can end it.
    fetchMock.mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit | undefined)?.signal;
        if (signal) {
          if (signal.aborted) {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
            return;
          }
          signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });
    vi.useFakeTimers();
    const guarded = safeFetchImage("https://slow.example.com/x.png").catch(
      (e) => e,
    );
    // Advance just past the per-hop budget but well under the global cap.
    // If only the global timer fired, this would NOT trigger an abort.
    await vi.advanceTimersByTimeAsync(FETCH_PER_HOP_TIMEOUT_MS + 100);
    const err = await guarded;
    expect(err).toBeInstanceOf(SafeFetchError);
    expect(err).toMatchObject({ code: "timeout" });
  });

  it("does not let a slow first hop starve a fast subsequent hop's per-hop budget", async () => {
    // Hop 0: 302 redirect that takes nearly the full per-hop budget to
    // emit headers. Hop 1: terminal 200 PNG response that arrives after
    // (FETCH_PER_HOP_TIMEOUT_MS - small slack). Pre-FG_109, the second
    // hop would inherit only the leftover global budget; post-FG_109,
    // hop 1 gets a fresh per-hop window, so the call succeeds.
    lookupMock.mockResolvedValue(publicLookup());
    const slowHopMs = FETCH_PER_HOP_TIMEOUT_MS - 200;
    fetchMock
      .mockImplementationOnce(async () => {
        // Vitest fake timers: setTimeout-as-Promise resolves only when
        // the fake clock is advanced past the delay.
        await new Promise((resolve) => setTimeout(resolve, slowHopMs));
        return new Response(null, {
          status: 302,
          headers: { location: "https://b.example.com/x.png" },
        });
      })
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, slowHopMs));
        return new Response(makePngBytes(16), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "content-length": "16",
          },
        });
      });

    vi.useFakeTimers();
    const promise = safeFetchImage("https://a.example.com/x.png");
    const guarded = promise.catch((e) => e);
    // Advance enough to clear both hops with their internal delays
    // (2 × slowHopMs ≈ 4.6s, comfortably under the 10s global cap but
    // each hop individually under the per-hop cap).
    await vi.advanceTimersByTimeAsync(2 * slowHopMs + 100);
    const result = await guarded;
    expect(result).not.toBeInstanceOf(Error);
    // Returned a Blob with the validated content-type.
    expect(result).toMatchObject({ type: "image/png" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
