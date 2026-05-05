// Re-export the canonical href builder from the shared `@feel-good/convex`
// helper so both the Next.js client and the Convex backend share one source
// of truth for the `/@<username>/<kind>/<slug>` URL shape. Legacy callers
// (`article-list-item.tsx`, `post-list-item.tsx`, `clone-actions-context.tsx`,
// `back-link.tsx`, `use-profile-workspace-route-data.ts`) keep importing
// `getContentHref` from `@/features/content`. See
// `.claude/rules/agent-parity.md` § Href-parity invariant.
import { type ContentKind } from "@feel-good/convex/convex/content/href";

export {
  buildContentHref as getContentHref,
  type ContentKind,
} from "@feel-good/convex/convex/content/href";

export const CONTENT_KINDS = ["posts", "articles"] as const;

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
