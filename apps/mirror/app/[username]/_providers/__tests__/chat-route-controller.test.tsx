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
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";

// ── Mutable mock state ────────────────────────────────────────────────────────

let mockIsChatOpen = true;
let mockRawConversationId: string | undefined = undefined;
let mockChatMode: "clone" | "configuration" = "clone";
let mockConversations: Array<{ _id: string; _creationTime: number }> = [];

const setConversationSpy = vi.fn();
const openChatSpy = vi.fn();
const closeChatSpy = vi.fn();
const useConversationsSpy = vi.fn();

// ── Module mocks (must be declared before importing the SUT) ──────────────────

vi.mock("@/hooks/use-chat-search-params", () => ({
  useChatSearchParams: () => ({
    isChatOpen: mockIsChatOpen,
    chatMode: mockChatMode,
    conversationId: mockRawConversationId,
    setConversation: setConversationSpy,
    openChat: openChatSpy,
    closeChat: closeChatSpy,
    buildChatAwareHref: vi.fn((p: string) => p),
  }),
}));

vi.mock("@/features/chat", () => ({
  useConversations: (args: unknown) => {
    useConversationsSpy(args);
    return {
      conversations: mockConversations,
      isLoading: false,
    };
  },
}));

vi.mock("@/features/chat/lib/parse-conversation-id", () => ({
  parseConversationId: (raw: string | string[] | undefined) =>
    raw === undefined
      ? { status: "none" }
      : raw === "INVALID"
        ? { status: "invalid" }
        : { status: "valid", id: raw },
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
      defaultProfileSection: "posts",
    },
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

const { ChatRouteController, useChatRouteController } =
  await import("@/app/[username]/_providers/chat-route-controller");

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
    useConversationsSpy.mockReset();
    mockIsChatOpen = true;
    mockRawConversationId = undefined;
    mockChatMode = "clone";
    mockConversations = [];
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
      latest!.handleConversationIdChange(newId as Id<"conversations">);
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
      latest!.handleConversationIdChange(newId as Id<"conversations">);
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
    expect(openChatSpy).toHaveBeenCalledWith({ mode: "clone" });
  });

  it("passes chatMode into the conversation query and preserves it when starting a new configuration chat", () => {
    let latest: Captured | null = null;
    mockChatMode = "configuration";

    render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    expect(useConversationsSpy).toHaveBeenLastCalledWith({
      profileOwnerId: "user_alice",
      mode: "configuration",
      enabled: true,
    });

    act(() => {
      latest!.handleConversationIdChange(null);
    });

    expect(openChatSpy).toHaveBeenCalledWith({ mode: "configuration" });
  });

  it("Auto-select effect does not double-fire while the bridge is active even when conversations populate", () => {
    let latest: Captured | null = null;

    const { rerender } = render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    // Initial: no URL conversation, no conversations → "empty".
    expect(latest!.routeResolution).toEqual({ status: "empty" });

    const newId = "conv_new_id_abcdef";
    act(() => {
      latest!.handleConversationIdChange(newId as Id<"conversations">);
    });

    // Bridge fires: setConversationSpy called once via handleConversationIdChange.
    expect(setConversationSpy).toHaveBeenCalledTimes(1);
    expect(setConversationSpy).toHaveBeenCalledWith(newId);

    // Conversations list catches up — includes the bridged id plus another row.
    mockConversations = [
      { _id: newId, _creationTime: 2 },
      { _id: "conv_other_id", _creationTime: 1 },
    ];
    rerender(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    // Auto-select effect MUST NOT double-fire while bridge is active.
    expect(setConversationSpy).toHaveBeenCalledTimes(1);
    expect(latest!.routeResolution).toEqual({
      status: "ready",
      conversationId: newId,
    });
  });

  it("URL conversationId wins over the bridge when they disagree", () => {
    let latest: Captured | null = null;

    const { rerender } = render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    act(() => {
      latest!.handleConversationIdChange("conv_bridge" as Id<"conversations">);
    });

    // URL navigates to a different conversation than the bridged id.
    mockRawConversationId = "conv_other";
    rerender(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    expect(latest!.routeResolution).toEqual({
      status: "ready",
      conversationId: "conv_other",
    });
  });

  // Documents intentional behavior — bridge persists across close because the
  // orphaned id is benign (always equals the user's most recent intent).
  it("Bridge persists across chat close and is still set when chat reopens", () => {
    let latest: Captured | null = null;

    const { rerender } = render(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    act(() => {
      latest!.handleConversationIdChange("conv_bridge" as Id<"conversations">);
    });

    // Chat closes — URL still has no conversation.
    mockIsChatOpen = false;
    rerender(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    // Chat reopens — URL still has no conversation.
    mockIsChatOpen = true;
    rerender(
      <Wrapper>
        <CaptureContext onValue={(v) => (latest = v)} />
      </Wrapper>,
    );

    expect(latest!.routeResolution).toEqual({
      status: "ready",
      conversationId: "conv_bridge",
    });
  });
});
