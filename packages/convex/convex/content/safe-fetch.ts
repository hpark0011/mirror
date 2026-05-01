"use node";

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
} from "./storage-policy";

const FETCH_TIMEOUT_MS = 10_000;

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
  | "timeout"
  | "http-error"
  | "network";

/**
 * Best-effort SSRF-guarded image fetch. Throws `SafeFetchError` on any
 * rejection condition. On success, returns the response body as a Blob with
 * the validated content-type set.
 */
export async function safeFetchImage(url: string): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_FETCH_REDIRECTS; hop++) {
      assertHttps(currentUrl);
      const parsed = new URL(currentUrl);
      await assertHostnameNotBlocked(parsed.hostname);

      let response: Response;
      try {
        response = await fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
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
      }

      if (isRedirect(response.status)) {
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
          throw new SafeFetchError(
            "size-limit",
            `Content-Length ${declared} exceeds ${MAX_INLINE_IMAGE_BYTES}`,
          );
        }
      }

      const bytes = await readWithLimit(response, MAX_INLINE_IMAGE_BYTES);
      // Cast to BlobPart-compatible view; Node's lib types narrow buffer to
      // `ArrayBuffer | SharedArrayBuffer` while the DOM Blob expects
      // `ArrayBuffer` only. The runtime accepts either.
      return new Blob([bytes as unknown as ArrayBuffer], {
        type: contentType,
      });
    }

    // Unreachable — the loop either returns, continues, or throws.
    throw new SafeFetchError(
      "redirect-overflow",
      `Exceeded ${MAX_FETCH_REDIRECTS} redirects`,
    );
  } finally {
    clearTimeout(timeout);
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
