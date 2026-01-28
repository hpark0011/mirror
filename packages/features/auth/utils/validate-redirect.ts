/**
 * Validates redirect URLs to prevent open redirect vulnerabilities.
 * Only allows relative paths or URLs matching the configured site origin.
 *
 * IMPORTANT: Set NEXT_PUBLIC_SITE_URL in your environment (e.g., https://yourapp.com).
 * Without it, only relative paths will be allowed and absolute URLs will be rejected.
 */

/**
 * Checks if a URL is safe to redirect to.
 * @param url - The URL to validate
 * @param allowedOrigins - Optional array of allowed origins. Defaults to NEXT_PUBLIC_SITE_URL.
 * @returns true if the URL is safe to redirect to
 */
export function isValidRedirectUrl(
  url: string,
  allowedOrigins?: string[]
): boolean {
  // Relative paths starting with / are always safe
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const allowed = allowedOrigins ?? (siteUrl ? [siteUrl] : []);

    // Check if the URL's origin matches any allowed origin
    return allowed.some((origin) => {
      try {
        const allowedUrl = new URL(origin);
        return parsed.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Returns a safe redirect URL, falling back to a default if the URL is invalid.
 * @param url - The URL to validate (can be null/undefined)
 * @param fallback - Fallback URL if validation fails. Defaults to "/dashboard"
 * @returns A safe URL to redirect to
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!url) return fallback;
  return isValidRedirectUrl(url) ? url : fallback;
}
