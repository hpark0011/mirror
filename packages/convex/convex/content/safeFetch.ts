"use node";

// Renamed from `safe-fetch.ts` to `safeFetch.ts` per FG_117 — the Convex
// 1.32.0 deploy server rejects hyphenated module paths regardless of
// content. Sibling modules in `content/` follow the same camelCase rule.
//
// Best-effort SSRF-guarded fetch for inline image imports.
//
// Threat model:
// - Rejects non-https URLs.
// - Resolves the target hostname via `node:dns/promises` and rejects any IP
//   that falls in RFC1918 private ranges, loopback, link-local, or
//   IPv6-ULA / loopback / link-local space.
// - Manual redirect handling: each redirect hop's hostname is RE-RESOLVED
//   and its IPs RE-CHECKED against the same blocklist before initiating the
//   next request (NOT a string-pattern check on the URL).
// - Caps the response body at MAX_INLINE_IMAGE_BYTES, both via Content-Length
//   pre-check and via streamed-byte counting.
// - Validates response Content-Type against ALLOWED_INLINE_IMAGE_TYPES.
//
// Non-property: This guard is NOT resistant to DNS rebinding. A correct
// rebinding-resistant implementation would resolve the hostname once,
// pin the resulting IP literal in the request socket, and bypass DNS for
// the actual TCP connect. Implementing that requires reaching into the
// underlying agent / connect callback and is out of scope here. The
// research spec (NFR-01) accepts this trade-off for Mirror's personal-blog
// risk profile.

import { lookup } from "node:dns/promises";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_FETCH_REDIRECTS,
  MAX_INLINE_IMAGE_BYTES,
} from "./storagePolicy";

export const FETCH_TIMEOUT_MS = 10_000;

/**
 * Per-hop timeout. Bounds the time any single redirect hop (DNS + TCP +
 * TLS + headers + body read) may consume independently of the global
 * outer cap. Prevents a slow intermediate hop from starving the body-size
 * check on the final hop. Computed so that a worst-case chain consuming
 * its full per-hop budget on every hop still adds up to the global cap.
 */
export const FETCH_PER_HOP_TIMEOUT_MS = Math.floor(
  FETCH_TIMEOUT_MS / (MAX_FETCH_REDIRECTS + 1),
);

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export type SafeFetchErrorCode =
  | "invalid-scheme"
  | "blocked-ip"
  | "dns-failure"
  | "redirect-overflow"
  | "missing-redirect-location"
  | "size-limit"
  | "content-type"
  | "invalid-magic-bytes"
  | "timeout"
  | "http-error"
  | "network";

/**
 * Verify the first bytes of the response body match the magic-byte
 * signature for the declared content-type. Defends against polyglot
 * payloads (e.g., HTML/JS bytes served as `image/png`) that would
 * otherwise land in Convex storage and be served with the attacker-
 * controlled MIME from our CDN.
 *
 * Constant-time, no allocation. Returns false (i.e., rejects) for any
 * declared type outside our PNG/JPEG/WebP allowlist as a fail-closed
 * default — `ALLOWED_INLINE_IMAGE_TYPES` is checked separately upstream
 * and stays the source of truth for what we accept.
 */
function isValidImageMagicBytes(
  bytes: Uint8Array,
  declaredContentType: string,
): boolean {
  if (declaredContentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (declaredContentType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (declaredContentType === "image/webp") {
    // RIFF<4-byte length>WEBP
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

/**
 * Best-effort SSRF-guarded image fetch. Throws `SafeFetchError` on any
 * rejection condition. On success, returns the response body as a Blob with
 * the validated content-type set.
 */
export async function safeFetchImage(url: string): Promise<Blob> {
  // Outer/global bound: a hard cap on the entire safeFetchImage call,
  // regardless of how the redirect chain plays out.
  const globalController = new AbortController();
  const globalTimeout = setTimeout(
    () => globalController.abort(),
    FETCH_TIMEOUT_MS,
  );

  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_FETCH_REDIRECTS; hop++) {
      assertHttps(currentUrl);
      const parsed = new URL(currentUrl);
      await assertHostnameNotBlocked(parsed.hostname);

      // Inner/per-hop bound: a fresh per-hop timer prevents a slow
      // intermediate hop from starving subsequent hops or the body-size
      // check on the terminal hop. The combined signal aborts as soon as
      // either the global or the per-hop timer fires.
      const hopController = new AbortController();
      const hopTimeout = setTimeout(
        () => hopController.abort(),
        FETCH_PER_HOP_TIMEOUT_MS,
      );
      const combinedSignal = AbortSignal.any([
        globalController.signal,
        hopController.signal,
      ]);

      let response: Response;
      try {
        response = await fetch(currentUrl, {
          redirect: "manual",
          signal: combinedSignal,
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === "AbortError" || err.name === "TimeoutError")
        ) {
          throw new SafeFetchError("timeout", "Fetch timed out");
        }
        throw new SafeFetchError(
          "network",
          `Network error: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        clearTimeout(hopTimeout);
      }

      if (isRedirect(response.status)) {
        // Drain the redirect response body so undici doesn't pin the
        // connection across the next hop. Mirrors the pattern used on the
        // !response.ok and bad-content-type paths below.
        response.body?.cancel().catch(() => {});
        if (hop === MAX_FETCH_REDIRECTS) {
          throw new SafeFetchError(
            "redirect-overflow",
            `Exceeded ${MAX_FETCH_REDIRECTS} redirects`,
          );
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new SafeFetchError(
            "missing-redirect-location",
            "Redirect response missing Location header",
          );
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        // Drain the body stream so we don't leak the underlying connection.
        // `cancel()` rejects if the body was already consumed; ignore.
        response.body?.cancel().catch(() => {});
        throw new SafeFetchError(
          "http-error",
          `HTTP ${response.status} ${response.statusText}`,
        );
      }

      const contentType = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_INLINE_IMAGE_TYPES.has(contentType)) {
        response.body?.cancel().catch(() => {});
        throw new SafeFetchError(
          "content-type",
          `Disallowed content-type: ${contentType || "(missing)"}`,
        );
      }

      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const declared = Number.parseInt(contentLengthHeader, 10);
        if (
          Number.isFinite(declared) &&
          declared > MAX_INLINE_IMAGE_BYTES
        ) {
          // Drain the body so we don't leak an undici connection on the
          // declared-too-big short-circuit (matches the pattern above).
          response.body?.cancel().catch(() => {});
          throw new SafeFetchError(
            "size-limit",
            `Content-Length ${declared} exceeds ${MAX_INLINE_IMAGE_BYTES}`,
          );
        }
      }

      const bytes = await readWithLimit(response, MAX_INLINE_IMAGE_BYTES);
      if (!isValidImageMagicBytes(bytes, contentType)) {
        throw new SafeFetchError(
          "invalid-magic-bytes",
          `Bytes do not match declared content-type: ${contentType}`,
        );
      }
      // `bytes.buffer` is `ArrayBufferLike` per the Node lib, but DOM Blob's
      // BlobPart expects `ArrayBuffer`. `readWithLimit` allocates with
      // `new Uint8Array(total)`, which always backs onto a regular
      // ArrayBuffer (not SharedArrayBuffer), so the narrow cast is safe.
      return new Blob([bytes.buffer as ArrayBuffer], { type: contentType });
    }

    // Unreachable — the loop either returns, continues, or throws.
    throw new SafeFetchError(
      "redirect-overflow",
      `Exceeded ${MAX_FETCH_REDIRECTS} redirects`,
    );
  } finally {
    clearTimeout(globalTimeout);
  }
}

function assertHttps(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SafeFetchError("invalid-scheme", `Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:") {
    throw new SafeFetchError(
      "invalid-scheme",
      `Only https URLs are allowed; got ${parsed.protocol}`,
    );
  }
}

async function assertHostnameNotBlocked(hostname: string): Promise<void> {
  // Strip IPv6 brackets if present.
  const host = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch (err) {
    throw new SafeFetchError(
      "dns-failure",
      `DNS lookup failed for ${host}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  for (const addr of addresses) {
    if (isBlockedAddress(addr.address, addr.family)) {
      throw new SafeFetchError(
        "blocked-ip",
        `Hostname ${host} resolved to blocked address ${addr.address}`,
      );
    }
  }
}

function isBlockedAddress(address: string, family: number): boolean {
  if (family === 4) {
    return isBlockedIPv4(address);
  }
  if (family === 6) {
    return isBlockedIPv6(address);
  }
  // Unknown family — fail closed.
  return true;
}

function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return true;
  }
  const [a, b] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  // 100.64.0.0/10 carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedIPv6(address: string): boolean {
  const lower = address.toLowerCase();
  // Loopback ::1
  if (lower === "::1") return true;
  // Unspecified ::
  if (lower === "::") return true;
  // IPv4-mapped IPv6: ::ffff:a.b.c.d
  const v4MappedMatch = lower.match(
    /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (v4MappedMatch) {
    const v4 = `${v4MappedMatch[1]}.${v4MappedMatch[2]}.${v4MappedMatch[3]}.${v4MappedMatch[4]}`;
    return isBlockedIPv4(v4);
  }
  // Compressed-hex IPv4-mapped form: ::ffff:HHHH:LLLL where each pair is a
  // 16-bit hex group encoding two octets of the v4 address. RFC 4291 § 2.5.5.2
  // permits both this and the dotted-decimal form for the same address; some
  // resolvers may surface the hex form, so we fail-closed by parsing it the
  // same way.
  const hexV4Match = lower.match(
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
  );
  if (hexV4Match) {
    const hi = Number.parseInt(hexV4Match[1]!, 16);
    const lo = Number.parseInt(hexV4Match[2]!, 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) {
      // Fail-closed on parse failure.
      return true;
    }
    const v4 = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
    return isBlockedIPv4(v4);
  }
  // Link-local fe80::/10
  if (lower.startsWith("fe8") || lower.startsWith("fe9") ||
      lower.startsWith("fea") || lower.startsWith("feb")) {
    return true;
  }
  // Unique local fc00::/7 (fc00::/8 and fd00::/8)
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  return false;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 ||
    status === 307 || status === 308;
}

async function readWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new SafeFetchError(
        "size-limit",
        `Response body ${buf.byteLength} exceeds ${maxBytes}`,
      );
    }
    return buf;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Ignore — we are already throwing.
        }
        throw new SafeFetchError(
          "size-limit",
          `Streamed bytes exceeded ${maxBytes}`,
        );
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore — releaseLock can throw if the reader is closed.
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
