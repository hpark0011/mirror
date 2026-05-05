import { describe, expect, it } from "vitest";
import { getContentHref, getContentRouteState, isContentKind } from "../types";

describe("getContentRouteState", () => {
  it("returns a route state for the 'posts' content kind", () => {
    expect(getContentRouteState(["posts"])).not.toBeNull();
  });

  it("returns a route state for the 'articles' content kind", () => {
    expect(getContentRouteState(["articles"])).not.toBeNull();
  });

  it("returns null for the 'clone-settings' tab (no list/detail semantics)", () => {
    expect(getContentRouteState(["clone-settings"])).toBeNull();
  });

  // Locks the inverted predicate (issue m11) against regression: a future
  // implementer must not restore the old enumeration logic that defaulted
  // unknown segments to a content kind.
  it("returns null for the 'bio' tab", () => {
    expect(getContentRouteState(["bio"])).toBeNull();
  });

  it("returns the kind/view/slug shape for a posts list", () => {
    const state = getContentRouteState(["posts"]);
    expect(state).toEqual({ kind: "posts", view: "list", slug: undefined });
  });

  it("returns the kind/view/slug shape for an article detail", () => {
    const state = getContentRouteState(["articles", "hello-world"]);
    expect(state).toEqual({
      kind: "articles",
      view: "detail",
      slug: "hello-world",
    });
  });

  it("returns null for an empty segments array", () => {
    expect(getContentRouteState([])).toBeNull();
  });
});

// Pins the canonical href shape `/@<username>/<kind>/<slug>`. The Convex
// side has an identical helper at `packages/convex/convex/chat/toolQueries.ts`
// (`buildContentHref`) feeding the `navigateToContent` agent tool's result.
// Both must produce byte-identical strings — drift between them silently
// breaks `useAgentIntentWatcher`'s assumption that the server-built `href`
// matches the client's user-UI navigation. Each side has its own test.
describe("getContentHref", () => {
  it("builds /@<username>/<kind>/<slug>", () => {
    expect(getContentHref("alice", "articles", "hello-world")).toBe(
      "/@alice/articles/hello-world",
    );
    expect(getContentHref("bob", "posts", "first-post")).toBe(
      "/@bob/posts/first-post",
    );
  });

  it("omits slug when not provided", () => {
    expect(getContentHref("alice", "articles")).toBe("/@alice/articles");
    expect(getContentHref("bob", "posts")).toBe("/@bob/posts");
  });
});

describe("isContentKind", () => {
  it("returns true for 'posts'", () => {
    expect(isContentKind("posts")).toBe(true);
  });

  it("returns true for 'articles'", () => {
    expect(isContentKind("articles")).toBe(true);
  });

  it("returns false for 'bio'", () => {
    expect(isContentKind("bio")).toBe(false);
  });

  it("returns false for 'clone-settings'", () => {
    expect(isContentKind("clone-settings")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isContentKind(null)).toBe(false);
    expect(isContentKind(undefined)).toBe(false);
  });
});
