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

export type ContentKind = "articles" | "posts";

export function buildContentHref(
  username: string,
  kind: ContentKind,
  slug?: string,
): string {
  const basePath = `/@${username}/${kind}`;
  return slug ? `${basePath}/${slug}` : basePath;
}

// Bio panel href. Kept separate from `buildContentHref` because the bio tab
// has no `slug` segment and is not a member of `ContentKind` — it's a tab
// without list/detail semantics (see `apps/mirror/features/content/types.ts`
// `getContentRouteState`'s "kindless tab" comment). Both the agent's `openBio`
// tool and any future user-UI dispatcher path import this helper so the URL
// shape has one source of truth.
export function buildBioHref(username: string): string {
  return `/@${username}/bio`;
}
