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
): ContentRouteState {
  const [kindSegment, slug] = segments;
  const kind = isContentKind(kindSegment)
    ? kindSegment
    : DEFAULT_PROFILE_CONTENT_KIND;

  return {
    kind,
    view: slug ? "detail" : "list",
    slug,
  };
}
