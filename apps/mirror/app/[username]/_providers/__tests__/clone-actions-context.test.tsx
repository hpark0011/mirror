import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { type ReactNode } from "react";

const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock("@/app/[username]/_providers/profile-route-data-context", () => ({
  useProfileRouteData: () => ({
    profile: {
      _id: "user_alice",
      authId: "auth_alice",
      username: "alice",
      name: "Alice",
      tagline: "",
      avatarUrl: undefined,
    },
    isOwner: false,
  }),
}));

const { CloneActionsProvider, useCloneActions } =
  await import("@/app/[username]/_providers/clone-actions-context");

function wrapper({ children }: { children: ReactNode }) {
  return <CloneActionsProvider>{children}</CloneActionsProvider>;
}

describe("CloneActionsProvider", () => {
  afterEach(() => {
    cleanup();
    pushSpy.mockReset();
  });

  it("passes an agent-provided content href through unchanged", () => {
    const { result } = renderHook(() => useCloneActions(), { wrapper });

    act(() => {
      result.current.navigateToContent({
        kind: "articles",
        slug: "ignored",
        href: "/@alice/articles/server-built",
      });
    });

    expect(pushSpy).toHaveBeenCalledWith("/@alice/articles/server-built", {
      scroll: false,
    });
  });

  it("composes a canonical content href for user navigation", () => {
    const { result } = renderHook(() => useCloneActions(), { wrapper });

    act(() => {
      result.current.navigateToContent({ kind: "articles", slug: "hello" });
    });

    expect(pushSpy).toHaveBeenCalledWith("/@alice/articles/hello", {
      scroll: false,
    });
  });

  it.each(["bio", "contact", "projects", "posts", "articles"] as const)(
    "composes the canonical %s section href without chat state",
    (section) => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToProfileSection({ section });
      });

      expect(pushSpy).toHaveBeenCalledWith(`/@alice/${section}`, {
        scroll: false,
      });
    },
  );

  it("passes an agent-provided section href through unchanged", () => {
    const { result } = renderHook(() => useCloneActions(), { wrapper });

    act(() => {
      result.current.navigateToProfileSection({
        section: "articles",
        href: "/@alice/articles/server-built",
      });
    });

    expect(pushSpy).toHaveBeenCalledWith("/@alice/articles/server-built", {
      scroll: false,
    });
  });

  it("composes an editor href for user navigation", () => {
    const { result } = renderHook(() => useCloneActions(), { wrapper });

    act(() => {
      result.current.navigateToEditor({ kind: "posts", slug: "draft" });
    });

    expect(pushSpy).toHaveBeenCalledWith("/@alice/posts/draft/edit", {
      scroll: false,
    });
  });

  it("passes an agent-provided editor href through unchanged", () => {
    const { result } = renderHook(() => useCloneActions(), { wrapper });

    act(() => {
      result.current.navigateToEditor({
        kind: "posts",
        slug: "ignored",
        editHref: "/@alice/posts/server-built/edit",
      });
    });

    expect(pushSpy).toHaveBeenCalledWith("/@alice/posts/server-built/edit", {
      scroll: false,
    });
  });
});
