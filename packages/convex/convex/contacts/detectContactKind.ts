import { CONTACT_ENTRY_KIND_VALUES, contactEntryKindValidator } from "./schema";
import { type Infer } from "convex/values";
import {
  CONTACT_HOSTNAME_ALLOWLIST,
  type NonEmailContactKind,
} from "./hostnameAllowlist";

export type DetectedContactKind = Infer<typeof contactEntryKindValidator>;

const CONTACT_KIND_SET = new Set<string>(CONTACT_ENTRY_KIND_VALUES);

export function isContactEntryKind(
  value: string,
): value is DetectedContactKind {
  return CONTACT_KIND_SET.has(value);
}

// Non-email kinds in the order they appear in CONTACT_ENTRY_KIND_VALUES.
const NON_EMAIL_KINDS = CONTACT_ENTRY_KIND_VALUES.filter(
  (k): k is NonEmailContactKind => k !== "email",
);

export function detectContactKind(value: string): DetectedContactKind | null {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "email";
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  for (const kind of NON_EMAIL_KINDS) {
    if (
      (CONTACT_HOSTNAME_ALLOWLIST[kind] as ReadonlyArray<string>).includes(host)
    ) {
      return kind;
    }
  }

  return null;
}
