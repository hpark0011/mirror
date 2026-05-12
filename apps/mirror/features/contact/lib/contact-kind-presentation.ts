import { type IconName } from "@feel-good/ui/components/icon";
import { type ContactEntryKind } from "../types";

/**
 * Single source of truth for per-kind labels, icons, placeholders, and
 * href shape. Both the card and the form pull from here so the user sees
 * consistent copy across the add dialog and the list view.
 *
 * `iconName` resolves to a `@feel-good/icons` export via the `Icon`
 * component. Brand-specific marks for LinkedIn/Instagram/TikTok/YouTube
 * aren't in the icon package yet, so those kinds fall back to the generic
 * `LinkIcon`. The kind label (`LinkedIn`, `Instagram`, …) still
 * distinguishes the rows visually.
 *
 * `hrefFor(value)` returns the URL the card's anchor uses:
 *  - email kind → `mailto:` with the typed address
 *  - everything else → the raw value (assumed https, validated upstream)
 */

type Presentation = {
  label: string;
  iconName: IconName;
  placeholder: string;
  /**
   * Build the user-visible anchor href from the stored payload. The card
   * passes the raw `value`; we do not pre-validate here — the
   * `safe-https-url` helper at the call site is the trust boundary for URL
   * kinds, and `mailto:` is unconditionally safe for the email kind.
   */
  hrefFor: (value: string) => string;
};

export const CONTACT_KIND_PRESENTATION: Record<ContactEntryKind, Presentation> = {
  email: {
    label: "Email",
    iconName: "EnvelopeFillIcon",
    placeholder: "you@example.com",
    hrefFor: (value) => `mailto:${value.trim()}`,
  },
  linkedin: {
    label: "LinkedIn",
    iconName: "LinkIcon",
    placeholder: "https://www.linkedin.com/in/your-handle",
    hrefFor: (value) => value.trim(),
  },
  instagram: {
    label: "Instagram",
    iconName: "LinkIcon",
    placeholder: "https://www.instagram.com/your-handle",
    hrefFor: (value) => value.trim(),
  },
  x: {
    label: "X",
    iconName: "XIcon",
    placeholder: "https://x.com/your-handle",
    hrefFor: (value) => value.trim(),
  },
  tiktok: {
    label: "TikTok",
    iconName: "LinkIcon",
    placeholder: "https://www.tiktok.com/@your-handle",
    hrefFor: (value) => value.trim(),
  },
  youtube: {
    label: "YouTube",
    iconName: "VideoFillIcon",
    placeholder: "https://www.youtube.com/@your-channel",
    hrefFor: (value) => value.trim(),
  },
};
