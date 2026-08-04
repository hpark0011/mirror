import { describe, expect, it } from "vitest";
import { getProfileRouteRedirect } from "../profile-route-redirect";

function redirectFor(pathname: string, query = ""): string | null {
  return getProfileRouteRedirect(pathname, new URLSearchParams(query));
}

describe("getProfileRouteRedirect", () => {
  it("redirects profile roots to clean Articles URLs", () => {
    expect(redirectFor("/@alice")).toBe("/@alice/articles");
    expect(redirectFor("/@alice/", "utm_source=test")).toBe("/@alice/articles");
  });

  it("redirects legacy chat routes to clean Articles URLs", () => {
    expect(redirectFor("/@alice/chat")).toBe("/@alice/articles");
    expect(
      redirectFor("/@alice/chat/conversation-123", "source=old-link"),
    ).toBe("/@alice/articles");
  });

  it.each(["chat", "conversation", "chatMode"])(
    "redirects any profile URL containing the %s parameter",
    (key) => {
      expect(redirectFor("/@alice/bio", `${key}=1&filter=recent`)).toBe(
        "/@alice/articles",
      );
    },
  );

  it("preserves valid content routes and their non-chat query state", () => {
    expect(
      redirectFor("/@alice/articles", "category=design&page=2"),
    ).toBeNull();
    expect(redirectFor("/@alice/posts/hello", "utm_source=test")).toBeNull();
  });

  it("does not canonicalize chat-like parameters outside profile routes", () => {
    expect(redirectFor("/sign-in", "chat=1")).toBeNull();
  });
});
