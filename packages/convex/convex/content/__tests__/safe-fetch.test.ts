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

import { safeFetchImage, SafeFetchError } from "../safe-fetch";
import { MAX_INLINE_IMAGE_BYTES } from "../storage-policy";

function publicLookup() {
  return [{ address: "93.184.216.34", family: 4 }];
}

function makePngResponse(byteLength: number) {
  const body = new Uint8Array(byteLength);
  return new Response(body, {
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
      new Response(new Uint8Array(8), {
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
      new Response(new Uint8Array(16), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "16" },
      }),
    );
    const jpeg = await safeFetchImage("https://example.com/a.jpg");
    expect(jpeg.type).toBe("image/jpeg");

    lookupMock.mockResolvedValue(publicLookup());
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array(16), {
        status: 200,
        headers: { "content-type": "image/webp", "content-length": "16" },
      }),
    );
    const webp = await safeFetchImage("https://example.com/a.webp");
    expect(webp.type).toBe("image/webp");
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
