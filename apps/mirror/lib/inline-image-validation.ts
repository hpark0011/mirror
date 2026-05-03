// Shared client-side validation for inline image uploads.
//
// `useArticleInlineImageUpload` and `usePostInlineImageUpload` both gate the
// upload pipeline on identical MIME + size checks (FR-11). Defining the error
// class and validation helper here means there is exactly ONE
// `InlineImageValidationError` class at runtime — so a consumer that catches
// via `if (err instanceof InlineImageValidationError)` works identically across
// articles and posts upload paths.
//
// Adding a new MIME type to the allowlist is a single edit in
// `./media-policy` (which re-exports the canonical Convex-side policy).
//
// Client-side-safe: depends only on the `./media-policy` neighbor — no Convex
// runtime imports, no Node imports.

import {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_INLINE_IMAGE_BYTES,
} from "./media-policy";

/**
 * Validation error thrown by inline image upload hooks. Distinguishes between
 * MIME-type and file-size rejections so the editor can surface a precise
 * message (FR-11). Thrown synchronously from `upload()` BEFORE any Convex
 * mutation/query is invoked — the hook is the trust boundary for client-side
 * validation.
 *
 * The `code` field union ("mime" | "size") is stable — production catch sites
 * may already discriminate on these values.
 */
export class InlineImageValidationError extends Error {
  readonly code: "mime" | "size";
  constructor(code: "mime" | "size", message: string) {
    super(message);
    this.code = code;
    this.name = "InlineImageValidationError";
  }
}

/**
 * Validate an inline image `File` against the shared media policy. Throws an
 * `InlineImageValidationError` on the first violation (MIME mismatch checked
 * before size). No-op on success.
 */
export function validateInlineImageFile(file: File): void {
  if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
    throw new InlineImageValidationError(
      "mime",
      "Image must be PNG, JPEG, or WEBP",
    );
  }
  if (file.size > MAX_INLINE_IMAGE_BYTES) {
    throw new InlineImageValidationError(
      "size",
      "Image must be smaller than 5 MB",
    );
  }
}
