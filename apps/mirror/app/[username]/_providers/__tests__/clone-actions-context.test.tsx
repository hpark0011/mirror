/**
 * FG_129 — Pins the server-built href bypass branch in `useCloneActions().navigateToContent`.
 *
 * The dispatcher has two branches:
 *   const basePath = href ?? getContentHref(profile.username, kind, slug);
 *
 * (a) Agent path: caller provides `href` (server-built) → passed through unchanged.
 * (b) User-UI path: caller omits `href` → client composes via getContentHref.
 *
 * A refactor that always called getContentHref would still pass the e2e if the
 * two builders produce the same string, but would silently break the contract
 * that the server is the source of truth for canonical hrefs. These unit tests
 * pin the bypass branch directly.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { type ReactNode } from "react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

// Stable profile fixture — username "alice" used in all assertions.
vi.mock(
  "@/app/[username]/_providers/profile-route-data-context",
  () => ({
    useProfileRouteData: () => ({
      profile: {
        _id: "user_alice" as unknown as string,
        authId: "auth_alice",
        username: "alice",
        name: "Alice",
        bio: "",
        avatarUrl: undefined,
      },
      isOwner: false,
      videoCallOpen: false,
      setVideoCallOpen: vi.fn(),
      isEditing: false,
      setIsEditing: vi.fn(),
      isSubmitting: false,
      setIsSubmitting: vi.fn(),
    }),
  }),
);

// Chat-open variant: buildChatAwareHref appends ?chat=1&conversation=conv_123
const CONV_ID = "conv_123";
const buildChatAwareHrefOpen = (basePath: string) =>
  `${basePath}?chat=1&conversation=${CONV_ID}`;

const buildChatAwareHrefClosed = (basePath: string) => basePath;

// Default mock — isChatOpen: true with a conversation id.
let mockBuildChatAwareHref = buildChatAwareHrefOpen;
let mockIsChatOpen = true;

vi.mock("@/hooks/use-chat-search-params", () => ({
  useChatSearchParams: () => ({
    isChatOpen: mockIsChatOpen,
    conversationId: CONV_ID,
    buildChatAwareHref: (p: string) => mockBuildChatAwareHref(p),
    openChat: vi.fn(),
    closeChat: vi.fn(),
    setConversation: vi.fn(),
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { useCloneActions, CloneActionsProvider } = await import(
  "@/app/[username]/_providers/clone-actions-context"
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <CloneActionsProvider>{children}</CloneActionsProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CloneActionsProvider — navigateToContent href bypass (FG_129)", () => {
  afterEach(() => {
    cleanup();
    pushSpy.mockReset();
    // Reset to chat-open default between tests
    mockBuildChatAwareHref = buildChatAwareHrefOpen;
    mockIsChatOpen = true;
  });

  describe("(a) agent path — server-built href is passed through unchanged", () => {
    it("calls router.push with the exact server-built href (not a recomposed shape)", () => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToContent({
          kind: "articles",
          slug: "x",
          href: "/@alice/articles/server-built",
        });
      });

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith(
        "/@alice/articles/server-built?chat=1&conversation=conv_123",
        { scroll: false },
      );
    });

    it("does NOT recompose to /@alice/articles/x when the server supplied /@alice/articles/server-built", () => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToContent({
          kind: "articles",
          slug: "x",
          href: "/@alice/articles/server-built",
        });
      });

      // The push arg must contain the server-built path, not the slug "x"
      const calledWith: string = pushSpy.mock.calls[0][0] as string;
      expect(calledWith).toContain("server-built");
      expect(calledWith).not.toContain("/articles/x");
    });

    it("preserves scroll: false option (documented invariant)", () => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToContent({
          kind: "articles",
          slug: "x",
          href: "/@alice/articles/server-built",
        });
      });

      expect(pushSpy).toHaveBeenCalledWith(expect.any(String), {
        scroll: false,
      });
    });
  });

  describe("(b) user-UI path — client composes href when omitted", () => {
    it("calls router.push with /@alice/articles/x when href is not provided", () => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToContent({ kind: "articles", slug: "x" });
      });

      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith(
        "/@alice/articles/x?chat=1&conversation=conv_123",
        { scroll: false },
      );
    });

    it("preserves scroll: false option (documented invariant)", () => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToContent({ kind: "articles", slug: "x" });
      });

      expect(pushSpy).toHaveBeenCalledWith(expect.any(String), {
        scroll: false,
      });
    });
  });

  describe("(c) chat-aware suffix preservation", () => {
    it("appends ?chat=1&conversation=<id> when isChatOpen is true (both branches)", () => {
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      // Agent path
      act(() => {
        result.current.navigateToContent({
          kind: "articles",
          slug: "x",
          href: "/@alice/articles/server-built",
        });
      });
      expect(pushSpy.mock.calls[0][0]).toContain("?chat=1&conversation=conv_123");

      pushSpy.mockReset();

      // User-UI path
      act(() => {
        result.current.navigateToContent({ kind: "articles", slug: "x" });
      });
      expect(pushSpy.mock.calls[0][0]).toContain("?chat=1&conversation=conv_123");
    });

    it("does NOT append chat suffix when isChatOpen is false", () => {
      mockBuildChatAwareHref = buildChatAwareHrefClosed;
      mockIsChatOpen = false;

      // Re-render with updated mock state (hooks re-read on each render)
      const { result } = renderHook(() => useCloneActions(), { wrapper });

      act(() => {
        result.current.navigateToContent({
          kind: "articles",
          slug: "y",
          href: "/@alice/articles/server-built",
        });
      });

      const calledWith: string = pushSpy.mock.calls[0][0] as string;
      expect(calledWith).not.toContain("chat=1");

      pushSpy.mockReset();

      act(() => {
        result.current.navigateToContent({ kind: "articles", slug: "y" });
      });

      const calledWith2: string = pushSpy.mock.calls[0][0] as string;
      expect(calledWith2).not.toContain("chat=1");
    });
  });
});

describe("CloneActionsProvider — navigateToProfileSection", () => {
  // Tab-level dispatcher parity: every ProfileTab section funnels through
  // `useCloneActions().navigateToProfileSection`. The agent path passes a
  // server-built href; the user-UI path omits it and the dispatcher
  // composes via `getProfileTabHref(username, section)`. The
  // `clone-settings` case exercises the dispatcher's wider section enum
  // (the agent enum is narrower — bio/articles/posts only) since the
  // dispatcher is also the user-UI path for the owner's Clone tab.
  afterEach(() => {
    cleanup();
    pushSpy.mockReset();
    mockBuildChatAwareHref = buildChatAwareHrefOpen;
    mockIsChatOpen = true;
  });

  const sections = ["bio", "articles", "posts", "clone-settings"] as const;

  for (const section of sections) {
    describe(`section: ${section}`, () => {
      const userPath = `/@alice/${section}`;
      // Deliberately non-canonical so pass-through vs recomposition is
      // detectable: `getProfileTabHref("alice", section)` would never
      // produce `/server-override`, so if the dispatcher ignored the
      // `href` arg and rebuilt from `section`, test (a) would fail.
      const agentPath = `/@alice/${section}/server-override`;

      it("(a) agent path — server-built href is passed through unchanged (not recomposed)", () => {
        const { result } = renderHook(() => useCloneActions(), { wrapper });

        act(() => {
          result.current.navigateToProfileSection({
            section,
            href: agentPath,
          });
        });

        expect(pushSpy).toHaveBeenCalledTimes(1);
        expect(pushSpy).toHaveBeenCalledWith(
          `${agentPath}?chat=1&conversation=conv_123`,
          { scroll: false },
        );
        // Defensive: confirm the user-UI path was NOT used. If the
        // bypass were absent, the push arg would be
        // `${userPath}?…` rather than `${agentPath}?…`.
        const calledWith = pushSpy.mock.calls[0][0] as string;
        expect(calledWith).not.toBe(`${userPath}?chat=1&conversation=conv_123`);
      });

      it("(b) user-UI path — dispatcher composes href when omitted", () => {
        const { result } = renderHook(() => useCloneActions(), { wrapper });

        act(() => {
          result.current.navigateToProfileSection({ section });
        });

        expect(pushSpy).toHaveBeenCalledTimes(1);
        expect(pushSpy).toHaveBeenCalledWith(
          `${userPath}?chat=1&conversation=conv_123`,
          { scroll: false },
        );
      });

      it("(c) preserves scroll: false invariant on both branches", () => {
        const { result } = renderHook(() => useCloneActions(), { wrapper });

        act(() => {
          result.current.navigateToProfileSection({
            section,
            href: agentPath,
          });
        });
        expect(pushSpy).toHaveBeenLastCalledWith(expect.any(String), {
          scroll: false,
        });

        pushSpy.mockReset();

        act(() => {
          result.current.navigateToProfileSection({ section });
        });
        expect(pushSpy).toHaveBeenLastCalledWith(expect.any(String), {
          scroll: false,
        });
      });

      it("(d) preserves chat-aware suffix when isChatOpen is true and elides it when false", () => {
        const { result: resultOpen } = renderHook(() => useCloneActions(), {
          wrapper,
        });

        act(() => {
          resultOpen.current.navigateToProfileSection({
            section,
            href: agentPath,
          });
        });
        expect(pushSpy.mock.calls[0][0]).toContain(
          "?chat=1&conversation=conv_123",
        );

        pushSpy.mockReset();

        act(() => {
          resultOpen.current.navigateToProfileSection({ section });
        });
        expect(pushSpy.mock.calls[0][0]).toContain(
          "?chat=1&conversation=conv_123",
        );

        pushSpy.mockReset();
        mockBuildChatAwareHref = buildChatAwareHrefClosed;
        mockIsChatOpen = false;

        const { result: resultClosed } = renderHook(() => useCloneActions(), {
          wrapper,
        });

        act(() => {
          resultClosed.current.navigateToProfileSection({
            section,
            href: agentPath,
          });
        });
        const calledAgent: string = pushSpy.mock.calls[0][0] as string;
        expect(calledAgent).not.toContain("chat=1");

        pushSpy.mockReset();

        act(() => {
          resultClosed.current.navigateToProfileSection({ section });
        });
        const calledUser: string = pushSpy.mock.calls[0][0] as string;
        expect(calledUser).not.toContain("chat=1");
      });
    });
  }
});
