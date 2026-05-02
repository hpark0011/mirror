---
id: FG_110
title: "safeFetchImage verifies image magic bytes before storing the blob"
date: 2026-05-02
type: improvement
status: to-do
priority: p3
description: "safeFetchImage trusts the response Content-Type header verbatim. An attacker hosting a JS or HTML file with Content-Type: image/png can force arbitrary bytes into Convex storage, served back via the CDN with the attacker-controlled MIME. Browsers that sniff content can be tricked into executing or rendering polyglot payloads. Add a magic-byte check (PNG, JPEG, WEBP signatures) after readWithLimit and reject mismatches."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "safeFetchImage inspects the first 8-12 bytes against PNG (\\x89PNG\\r\\n\\x1a\\n), JPEG (\\xFF\\xD8\\xFF), WebP (RIFF....WEBP) signatures"
  - "Content-Type / magic-byte mismatch throws SafeFetchError with code 'invalid-magic-bytes' (new code)"
  - "New Vitest cases: PNG bytes with image/jpeg Content-Type rejected; HTML bytes with image/png Content-Type rejected; valid PNG accepted; valid WEBP accepted"
  - "Existing safe-fetch tests pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend / security specialist"
---

# safeFetchImage verifies image magic bytes before storing the blob

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #32, adversarial reviewer at confidence 0.72.

`packages/convex/convex/content/safe-fetch.ts:123-133` accepts the response Content-Type header verbatim:

```ts
const contentType = (response.headers.get("content-type") ?? "")
  .split(";")[0].trim().toLowerCase();
if (!ALLOWED_INLINE_IMAGE_TYPES.has(contentType)) {
  // reject
}
```

Then at line 153 stores the bytes with that exact Content-Type as a Blob. `ctx.storage.store(blob)` saves it; `ctx.storage.getUrl()` returns a Convex CDN URL serving with the stored Content-Type.

An attacker hosting `https://attacker.example/payload.html`:
- Returns `Content-Type: image/png` and arbitrary HTML/JS bytes.
- safeFetchImage allows it (header check passes, no body content check).
- Bytes land in Convex storage, served as `image/png` from the Convex CDN.
- Browsers that MIME-sniff (e.g., Internet Explorer historically, edge-case configs in Chromium) may render or execute the payload as a polyglot.
- Even modern browsers respecting `nosniff` headers don't fully neutralize stored XSS payloads if the file is later served in a different context.

A shallow magic-byte check at the import boundary cuts this off: only reject obviously-not-an-image bytes; don't try to be a full image parser.

## Goal

After this ticket, only bytes that begin with a known image magic-byte sequence land in Convex storage via the markdown-import flow. Polyglot files with mismatched declared/actual content type are rejected with a clear error code.

## Scope

- `packages/convex/convex/content/safe-fetch.ts` — add magic-byte check after `readWithLimit`.
- New `SafeFetchErrorCode` value: `"invalid-magic-bytes"`.
- Vitest cases.

## Out of Scope

- Full image format validation (parsing entire PNG/JPEG/WEBP structure).
- Magic-byte check for browser-side paste/drop uploads (those bytes come from the user's clipboard / file system; trusted enough vs. external URL fetches).
- AVIF / HEIC support (out of allowlist anyway).

## Approach

```ts
function isValidImageMagicBytes(bytes: Uint8Array, declaredContentType: string): boolean {
  if (declaredContentType === "image/png") {
    return bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e
      && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a
      && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (declaredContentType === "image/jpeg") {
    return bytes.length >= 3
      && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (declaredContentType === "image/webp") {
    // RIFF....WEBP
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

// after readWithLimit:
if (!isValidImageMagicBytes(bytes, contentType)) {
  throw new SafeFetchError(
    "invalid-magic-bytes",
    `Bytes do not match declared content-type: ${contentType}`,
  );
}
```

- **Effort:** Small
- **Risk:** Low — strict additive check; legitimate image fetches unaffected.

## Implementation Steps

1. Add `"invalid-magic-bytes"` to `SafeFetchErrorCode` union in `safe-fetch.ts`.
2. Add the `isValidImageMagicBytes` helper.
3. Call the helper after `readWithLimit` and before `new Blob(...)`. Throw on mismatch.
4. Add Vitest cases: valid PNG/JPEG/WEBP, mismatched Content-Type with HTML bytes, declared PNG with empty bytes.
5. Run all tests.

## Constraints

- Cannot regress legitimate image imports — verified via existing happy-path tests.
- Magic-byte check must be cheap (constant-time, no allocation beyond what readWithLimit already produced).
- Error code is now part of the action's failure reason vocabulary — surface it through the markdown-import dialog gracefully.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #32.
- `packages/convex/convex/content/safe-fetch.ts:123-153` — content-type / store boundary.
- File-format magic byte references — PNG (RFC 2083), JPEG (ITU-T T.81), WebP (RFC 9649).
