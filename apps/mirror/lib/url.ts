/**
 * Remove one or more trailing slashes from a URL string.
 */
export function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
