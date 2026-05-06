import { thumbHashToDataURL } from "thumbhash";

/**
 * Decode a base64 thumbhash to a `data:image/png;base64,…` URL suitable for
 * `next/image`'s `blurDataURL` prop. Returns null for null/empty input so
 * call sites can short-circuit cleanly.
 */
export function thumbhashToDataUrl(thumbhash: string | null): string | null {
  if (!thumbhash) return null;
  const binary = atob(thumbhash);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return thumbHashToDataURL(bytes);
}
