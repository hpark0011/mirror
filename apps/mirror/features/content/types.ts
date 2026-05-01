export const CONTENT_KINDS = ["posts", "articles"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

export const DEFAULT_PROFILE_CONTENT_KIND: ContentKind = "posts";

export type ContentRouteView = "list" | "detail";

export type ContentRouteState = {
  kind: ContentKind;
  view: ContentRouteView;
  slug?: string;
};

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  posts: "Posts",
  articles: "Articles",
};

export function isContentKind(
  value: string | null | undefined,
): value is ContentKind {
  return value === "articles" || value === "posts";
}

export function getContentHref(
  username: string,
  kind: ContentKind,
  slug?: string,
) {
  const basePath = `/@${username}/${kind}`;
  return slug ? `${basePath}/${slug}` : basePath;
}

export function getContentRouteState(
  segments: readonly string[],
): ContentRouteState | null {
  // Inverted predicate (issue m11): only routes whose first segment is a
  // content kind (posts/articles) have list/detail semantics. Every other
  // tab — clone-settings, bio, and any future kindless tab — yields a null
  // route state. New tabs without list/detail semantics no longer require
  // touching this file; the closed CONTENT_KINDS set is self-maintaining.
  const [kindSegment, slug] = segments;
  if (!isContentKind(kindSegment)) return null;

  return {
    kind: kindSegment,
    view: slug ? "detail" : "list",
    slug,
  };
}
