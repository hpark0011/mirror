// Client-safe re-exports of the inline image upload policy.
//
// Inline image and cover image policies are deliberately the same (5 MiB,
// PNG/JPEG/WEBP). Both client validation sites (cover-image-picker,
// markdown-upload-dialog-connector, the inline upload hook) MUST import
// from this module so that the policy stays single-sourced from the
// Convex-side `storage-policy` constants.

import { ALLOWED_INLINE_IMAGE_TYPES } from "@feel-good/convex/convex/content/storage-policy";

export {
  ALLOWED_INLINE_IMAGE_TYPES,
  MAX_INLINE_IMAGE_BYTES,
} from "@feel-good/convex/convex/content/storage-policy";

/**
 * Comma-joined string suitable for the `accept` attribute of an
 * `<input type="file">`. Derived from `ALLOWED_INLINE_IMAGE_TYPES` so it
 * cannot drift from the canonical Set.
 */
export const ALLOWED_INLINE_IMAGE_TYPES_ATTR = [
  ...ALLOWED_INLINE_IMAGE_TYPES,
].join(",");
