import { CONTACT_ENTRY_KIND_VALUES, contactEntryKindValidator } from "./schema";
import { type Infer } from "convex/values";

export type DetectedContactKind = Infer<typeof contactEntryKindValidator>;

const CONTACT_KIND_SET = new Set<string>(CONTACT_ENTRY_KIND_VALUES);

export function isContactEntryKind(
  value: string,
): value is DetectedContactKind {
  return CONTACT_KIND_SET.has(value);
}

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

  if (host === "linkedin.com") return "linkedin";
  if (host === "instagram.com") return "instagram";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "tiktok.com") return "tiktok";
  if (host === "youtube.com" || host === "youtu.be") return "youtube";

  return null;
}
