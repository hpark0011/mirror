import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

let mockSearchParams = new URLSearchParams();
const pushSpy = vi.fn();
const replaceSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/@alice",
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
}));

const { useChatSearchParams } = await import("../use-chat-search-params");

describe("useChatSearchParams", () => {
  afterEach(() => {
    cleanup();
    mockSearchParams = new URLSearchParams();
    pushSpy.mockReset();
    replaceSpy.mockReset();
  });

  it("buildChatAwareHref preserves configuration chat mode and conversation id", () => {
    mockSearchParams = new URLSearchParams(
      "chat=1&chatMode=configuration&conversation=conv_123",
    );

    const { result } = renderHook(() => useChatSearchParams());

    expect(result.current.chatMode).toBe("configuration");
    expect(result.current.buildChatAwareHref("/@alice/bio")).toBe(
      "/@alice/bio?chat=1&chatMode=configuration&conversation=conv_123",
    );
  });

  it("openChat can switch explicitly between clone and configuration modes", () => {
    mockSearchParams = new URLSearchParams("chat=1&conversation=conv_123");
    const { result } = renderHook(() => useChatSearchParams());

    result.current.openChat({ mode: "configuration" });
    expect(pushSpy).toHaveBeenLastCalledWith(
      "/@alice?chat=1&chatMode=configuration",
    );

    result.current.openChat({ mode: "clone" });
    expect(pushSpy).toHaveBeenLastCalledWith("/@alice?chat=1");
  });

  it("closeChat clears chat, conversation, and chatMode from the URL", () => {
    mockSearchParams = new URLSearchParams(
      "chat=1&chatMode=configuration&conversation=conv_123",
    );
    const { result } = renderHook(() => useChatSearchParams());

    result.current.closeChat();

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const pushedUrl = pushSpy.mock.calls[0]?.[0] as string;
    expect(pushedUrl).toBe("/@alice");
    expect(pushedUrl).not.toContain("chat=");
    expect(pushedUrl).not.toContain("chatMode=");
    expect(pushedUrl).not.toContain("conversation=");
  });
});
