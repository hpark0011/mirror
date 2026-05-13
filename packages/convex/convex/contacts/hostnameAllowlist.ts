/**
 * Canonical hostname allowlist for non-email contact kinds, plus the
 * `validateValue` function that enforces hostname-vs-kind at the mutation
 * boundary.
 *
 * This module is the single source of truth shared between:
 * - `detectContactKind.ts` — maps a URL to a ContactEntryKind
 * - `writeHelpers.ts:validateValue` → re-exported from here
 *
 * Both the `twitter.com → x` and `youtu.be → youtube` aliases are included.
 *
 * No imports from `_generated/api`, `auth/client`, or `content/helpers` —
 * this keeps the file testable without needing Convex env vars set.
 */

export type NonEmailContactKind =
  | "linkedin"
  | "instagram"
  | "x"
  | "tiktok"
  | "youtube";

export type ContactEntryKindForValidation = NonEmailContactKind | "email";

export const CONTACT_HOSTNAME_ALLOWLIST: Record<
  NonEmailContactKind,
  ReadonlyArray<string>
> = {
  linkedin: ["linkedin.com"],
  instagram: ["instagram.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
};

/**
 * Returns true if the hostname (after lowercasing and stripping a leading
 * `www.` prefix) is in the allowlist for the given contact kind.
 */
export function isAllowedContactHost(
  kind: NonEmailContactKind,
  hostname: string,
): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return (CONTACT_HOSTNAME_ALLOWLIST[kind] as ReadonlyArray<string>).includes(
    normalized,
  );
}

const MAX_VALUE_LENGTH = 2000;

/**
 * Validates a contact entry value against its declared kind.
 * - email: must match a basic email regex
 * - all other kinds: must be a valid https URL whose hostname is in the
 *   per-kind allowlist (CONTACT_HOSTNAME_ALLOWLIST)
 *
 * Throws a descriptive Error on invalid input; returns void on success.
 */
export function validateValue(
  kind: ContactEntryKindForValidation,
  value: string,
): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("value is required");
  }
  if (trimmed.length > MAX_VALUE_LENGTH) {
    throw new Error(
      `value exceeds maximum length of ${MAX_VALUE_LENGTH} (got ${trimmed.length})`,
    );
  }
  if (kind === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("email must be a valid email address");
    }
    return;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("value must be a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("URL must use https://");
  }
  if (!isAllowedContactHost(kind, url.hostname)) {
    const allowed = CONTACT_HOSTNAME_ALLOWLIST[kind].join(" or ");
    throw new Error(`${kind} value must point at ${allowed}`);
  }
}
