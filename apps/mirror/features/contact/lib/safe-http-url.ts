/**
 * Returns the trimmed URL only when it parses as `https:`.
 *
 * Contact entries for URL kinds are user-supplied strings rendered into
 * `<a href>`. React 19 already blocks `javascript:` URLs, but `data:` and
 * other schemes pass through. Contacts use https-only URLs by validator
 * design, so this narrows the surface further than bio's helper.
 */
export function safeHttpsUrl(input: string | undefined | null): string | null {
  const value = input?.trim();
  if (!value) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
