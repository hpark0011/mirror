/**
 * Returns the trimmed URL only when it parses as `http:` or `https:`.
 *
 * Bio entry links are user-supplied strings rendered into `<a href>`. React 19
 * already blocks `javascript:` URLs, but `data:` and other schemes pass
 * through. This narrows the surface to the two protocols a profile link is
 * ever expected to use.
 */
export function safeHttpUrl(input: string | undefined | null): string | null {
  const value = input?.trim();
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
