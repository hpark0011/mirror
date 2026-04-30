export const PROFILE_TAB_KINDS = [
  "posts",
  "articles",
  "bio",
  "clone-settings",
] as const;
export type ProfileTabKind = (typeof PROFILE_TAB_KINDS)[number];

// Decoupled from PROFILE_TAB_KINDS tuple position (issue I4) so reordering the
// tuple — e.g. inserting a new tab — never silently changes the workspace's
// default-fallback tab. The default is an explicit literal.
export const PROFILE_TAB_DEFAULT_KIND: ProfileTabKind = "posts";

// Visual ordering for the profile tab row. Decoupled from PROFILE_TAB_KINDS so
// the canonical kind list can be reordered (e.g. for default-kind preservation)
// without affecting the rendered tab order. types.test.ts asserts set-equality
// between the two constants to guard against drift.
export const PROFILE_TAB_DISPLAY_ORDER: readonly ProfileTabKind[] = [
  "bio",
  "posts",
  "articles",
  "clone-settings",
];

export const PROFILE_TAB_LABELS: Record<ProfileTabKind, string> = {
  posts: "Posts",
  articles: "Articles",
  bio: "Bio",
  "clone-settings": "Clone",
};
export function isProfileTabKind(value: string | null | undefined): value is ProfileTabKind {
  return typeof value === "string" && PROFILE_TAB_KINDS.includes(value as ProfileTabKind);
}
export function getProfileTabHref(username: string, kind: ProfileTabKind): string {
  return `/@${username}/${kind}`;
}
