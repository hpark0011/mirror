// Canonical content href builder.
//
// IMPORTANT: This is the single source of truth for the content URL shape
// `/@<username>/<articles|posts>/<slug>` across the repo. Do NOT inline a
// parallel implementation on the client — import from here via
// `@feel-good/convex/convex/content/href`. See `.claude/rules/agent-parity.md`
// § Href-parity invariant.
//
// Pure module: no Convex runtime imports, so it is safe to import from both
// the Convex backend (chat tool data resolution) and the Next.js client
// (user-UI list items, dispatcher composing default hrefs).
//
// Must stay aligned with the Next.js dynamic route at
// `apps/mirror/app/[username]/<kind>/[slug]/page.tsx`. A change to the URL
// template requires editing this file once — both consumers re-export from
// here.

import {
  getNavigableContentSource,
  isNavigableContentKind,
  NAVIGABLE_CONTENT_KINDS,
  type NavigableContentKind,
} from "./sourceRegistry";

export type ContentKind = NavigableContentKind;

export {
  getNavigableContentSource,
  isNavigableContentKind,
  NAVIGABLE_CONTENT_KINDS,
};

export const DEFAULT_PROFILE_SECTION_VALUES = [
  "bio",
  "contact",
  "posts",
  "articles",
] as const;
export type DefaultProfileSection =
  (typeof DEFAULT_PROFILE_SECTION_VALUES)[number];
export const DEFAULT_PROFILE_SECTION: DefaultProfileSection = "posts";

export function buildContentHref(
  username: string,
  kind: ContentKind,
  slug?: string,
): string {
  const source = getNavigableContentSource(kind);
  const basePath = `/@${username}/${source.navigation.routeSegment}`;
  return slug ? `${basePath}/${slug}` : basePath;
}

// Profile section identifier — covers every ProfileTab the user-UI dispatcher
// can navigate to. The agent's `openProfileSection` tool pins to a strict
// subset (`bio | contact | articles | posts`); owner-only sections are not
// part of the agent's verb space (see `chat/tools.ts`).
export type ProfileSection =
  | "bio"
  | "contact"
  | ContentKind
  | "clone-settings"
  | "settings";

// Server-side parallel of `getProfileTabHref` at
// `apps/mirror/features/profile-tabs/types.ts`. The href-parity invariant is
// pinned in `apps/mirror/features/profile-tabs/__tests__/types.test.ts` for
// every section.
export function buildProfileSectionHref(
  username: string,
  section: ProfileSection,
): string {
  if (isNavigableContentKind(section)) {
    return buildContentHref(username, section);
  }
  return `/@${username}/${section}`;
}

// Bio panel href. Kept as a thin alias over `buildProfileSectionHref` so
// existing call sites (`chat/toolQueries.ts:queryBioPanel`, plus tests) do not
// need to migrate, and the URL template lives in exactly one place.
export function buildBioHref(username: string): string {
  return buildProfileSectionHref(username, "bio");
}

// Contact panel href. Parallel of `buildBioHref` for the contact section so
// `chat/toolQueries.ts:queryContactPanel` and any future call site share a
// single URL template.
export function buildContactHref(username: string): string {
  return buildProfileSectionHref(username, "contact");
}
