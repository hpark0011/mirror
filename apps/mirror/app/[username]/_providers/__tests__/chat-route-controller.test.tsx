/**
 * Pins the `pendingNewConversationId` bridge in `ChatRouteController`.
 *
 * The bridge prevents a one-render flash to `{ status: "resolving" }` on the
 * first message send, when the Convex `conversations` reactive query updates
 * before `router.replace(?conversation=…)` flushes. These tests exercise:
 *
 *   1. The bridge takes effect immediately — `routeResolution` is "ready" on
 *      the same render that `handleConversationIdChange(newId)` ran.
 *   2. After the URL flushes (rerender with the same id), `routeResolution`
 *      stays "ready" — no flicker.
 *   3. `handleConversationIdChange(null)` puts the resolution into
 *      "new_conversation" and calls `openChat`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";

// ── Mutable mock state ────────────────────────────────────────────────────────

let mockIsChatOpen = true;
let mockRawConversationId: string | undefined = undefined;
let mockConversations: Array<{ _id: string; _creationTime: number }> = [];
let mockConversationsLoading = false;

const setConversationSpy = vi.fn();
const openChatSpy = vi.fn();
const closeChatSpy = vi.fn();

// ── Module mocks (must be declared before importing the SUT) ──────────────────

vi.mock("@/hooks/use-chat-search-params", () => ({
  useChatSearchParams: () => ({
    isChatOpen: mockIsChatOpen,
    conversationId: mockRawConversationId,
    setConversation: setConversationSpy,
    openChat: openChatSpy,
    closeChat: closeChatSpy,
    buildChatAwareHref: vi.fn((p: string) => p),
  }),
}));

vi.mock("@/features/chat", () => ({
  useConversations: () => ({
    conversations: mockConversations,
    isLoading: mockConversationsLoading,
  }),
}));

vi.mock("@/features/chat/lib/parse-conversation-id", () => ({
  parseConversationId: (raw: string | string[] | undefined) =>
    raw === undefined
      ? { status: "none" }
      : raw === "INVALID"
        ? { status: "invalid" }
        : { status: "valid", id: raw },
}));

vi.mock(
  "@/app/[username]/_providers/profile-route-data-context",
  () => ({
    useProfileRouteData: () => ({
      profile: {
        _id: "user_alice",
        authId: "auth_alice",
        username: "alice",
        name: "Alice",
        bio: "",
        avatarUrl: undefined,
      },
    }),
  }),
);

// ── Import after mocks ────────────────────────────────────────────────────────

const { ChatRouteController, useChatRouteController } = await import(
  "@/app/[username]/_providers/chat-route-controller"
);

// ── Test consumer that exposes the context to the test ────────────────────────

type Captured = {
  routeResolution: ReturnType<typeof useChatRouteController>["routeResolution"];
  handleConversationIdChange: ReturnType<
    typeof useChatRouteController
  >["handleConversationIdChange"];
};

function CaptureContext({ onValue }: { onValue: (v: Captured) => void }) {
  const ctx = useChatRouteController();
  useEffect(() => {
    onValue({
      routeResolution: ctx.routeResolution,
      handleConversationIdChange: ctx.handleConversationIdChange,
    });
  });
  return null;
}

function Wrapper({ children }: { children: ReactNode }) {
  return <ChatRouteController>{children}</ChatRouteController>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChatRouteController — pendingNewConversationId bridge", () => {
  afterEach(() => {
    cleanup();
    setConversationSpy.mockReset();
    openChatSpy.mockReset();
    closeChatSpy.mockReset();
    mockIsChatOpen = true;
    mockRawConversationId = undefined;
    mockConversations = [];
    mockConversationsLoading = false;
  });

  it("routeResolution becomes 'ready' immediately after handleConversationIdChange(newId), before the URL flushes", () => {
    let latest: Captured | null = null;

    render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    expect(latest).not.toBeNull();
    // Initial: no URL conversation, no conversations → "empty"
    expect(latest!.routeResolution).toEqual({ status: "empty" });

    const newId = "conv_new_id_abcdef";
    act(() => {
      latest!.handleConversationIdChange(newId as never);
    });

    // URL has NOT yet been updated (mockRawConversationId still undefined),
    // but routeResolution should already be "ready" via the bridge.
    expect(latest!.routeResolution).toEqual({
      status: "ready",
      conversationId: newId,
    });
    expect(setConversationSpy).toHaveBeenCalledWith(newId);
  });

  it("routeResolution stays 'ready' across the URL flush — no flicker", () => {
    let latest: Captured | null = null;

    const { rerender } = render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    const newId = "conv_new_id_abcdef";
    act(() => {
      latest!.handleConversationIdChange(newId as never);
    });

    expect(latest!.routeResolution).toEqual({
      status: "ready",
      conversationId: newId,
    });

    // Simulate the URL catching up.
    mockRawConversationId = newId;
    rerender(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    // No flicker — still ready with the same id.
    expect(latest!.routeResolution).toEqual({
      status: "ready",
      conversationId: newId,
    });

    // Auto-select must NOT have fired an extra setConversation while the
    // bridge was active.
    expect(setConversationSpy).toHaveBeenCalledTimes(1);
    expect(setConversationSpy).toHaveBeenCalledWith(newId);
  });

  it("routeResolution becomes 'new_conversation' after handleConversationIdChange(null)", () => {
    let latest: Captured | null = null;

    render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    act(() => {
      latest!.handleConversationIdChange(null);
    });

    expect(latest!.routeResolution).toEqual({ status: "new_conversation" });
    expect(openChatSpy).toHaveBeenCalledTimes(1);
  });
});
