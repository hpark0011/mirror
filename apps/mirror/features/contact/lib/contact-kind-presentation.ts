import { type IconName } from "@feel-good/ui/components/icon";
import { CONTACT_KIND_LABEL } from "@feel-good/convex/convex/contacts/labels";
import { type ContactEntryKind } from "../types";

/**
 * Single source of truth for per-kind labels, icons, and placeholders.
 * The contact card builds anchor hrefs itself — `mailto:` inline for the
 * email kind, `safeHttpsUrl(...)` for URL kinds — so this record stays
 * decoupled from href construction. The previous `hrefFor` field was a
 * trap: only the email branch ever called it, while URL kinds went
 * through the https sanitizer at the call site.
 *
 * `iconName` resolves to a `@feel-good/icons` export via the `Icon`
 * component. Brand-specific marks for LinkedIn/Instagram/TikTok/YouTube
 * aren't in the icon package yet, so those kinds fall back to the generic
 * `LinkIcon`. The kind label (`LinkedIn`, `Instagram`, …) still
 * distinguishes the rows visually.
 */

type Presentation = {
  label: string;
  iconName: IconName;
  placeholder: string;
};

export const CONTACT_KIND_PRESENTATION: Record<ContactEntryKind, Presentation> = {
  email: {
    label: CONTACT_KIND_LABEL.email,
    iconName: "EnvelopeFillIcon",
    placeholder: "you@example.com",
  },
  linkedin: {
    label: CONTACT_KIND_LABEL.linkedin,
    iconName: "LinkIcon",
    placeholder: "https://www.linkedin.com/in/your-handle",
  },
  instagram: {
    label: CONTACT_KIND_LABEL.instagram,
    iconName: "LinkIcon",
    placeholder: "https://www.instagram.com/your-handle",
  },
  x: {
    label: CONTACT_KIND_LABEL.x,
    iconName: "XIcon",
    placeholder: "https://x.com/your-handle",
  },
  tiktok: {
    label: CONTACT_KIND_LABEL.tiktok,
    iconName: "LinkIcon",
    placeholder: "https://www.tiktok.com/@your-handle",
  },
  youtube: {
    label: CONTACT_KIND_LABEL.youtube,
    iconName: "VideoFillIcon",
    placeholder: "https://www.youtube.com/@your-channel",
  },
};
