/**
 * Pins the conversation-scoped idempotency contract on
 * `useAgentIntentWatcher`:
 *
 *   (a) Re-rendering the same hook with the same messages dispatches once.
 *   (b) Unmounting and remounting the hook with the same persisted
 *       messages dispatches zero additional times — this is the bug
 *       FG_127 fixed (mount-scoped Set → conversation-scoped Map).
 *   (c) Tool parts in `state: "input-streaming"` are never dispatched.
 *   (d) Tool parts in `state: "output-error"` are never dispatched.
 *   (e) `output-available` with a malformed payload (failing
 *       `isNavigateOutput`) is never dispatched.
 *   (f) Two distinct toolCallIds in one assistant turn each dispatch once.
 *
 * The hook reads `useCloneActions().navigateToContent` and
 * `.navigateToProfileSection`. We mock the provider module so the hook can
 * run outside `<CloneActionsProvider>`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import type { UIMessage } from "@convex-dev/agent/react";

const navigateToContentMock = vi.fn();
const navigateToProfileSectionMock = vi.fn();

vi.mock("@/app/[username]/_providers/clone-actions-context", () => ({
  useCloneActions: () => ({
    navigateToContent: navigateToContentMock,
    navigateToProfileSection: navigateToProfileSectionMock,
  }),
}));

// Import after the mock so the hook picks up the mocked provider.
const { useAgentIntentWatcher, handledByConversation } = await import(
  "@/features/chat/hooks/use-agent-intent-watcher"
);

const CONV_ID = "conv_test_1";
const CONV_ID_2 = "conv_test_2";

type ToolPart = {
  type: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  toolCallId: string;
  output?: unknown;
};

function makeAssistantMessage(parts: ToolPart[]): UIMessage {
  // Cast through `unknown` — the production hook narrows part shape at
  // runtime; the union type from `@convex-dev/agent/react` is broader
  // than what we need to assert tested behaviour.
  return {
    id: "msg_assistant_1",
    role: "assistant",
    parts,
  } as unknown as UIMessage;
}

function makeNavigateOutputPart(toolCallId: string, slug = "hello-world") {
  return {
    type: "tool-navigateToContent",
    state: "output-available" as const,
    toolCallId,
    output: {
      kind: "articles",
      slug,
      title: "Hello world",
      href: `/@rick-rubin/articles/${slug}`,
    },
  };
}

describe("useAgentIntentWatcher", () => {
  beforeEach(() => {
    navigateToContentMock.mockReset();
    navigateToProfileSectionMock.mockReset();
    handledByConversation.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("(a) dispatches once when the same messages re-render within a single mount", () => {
    const messages = [
      makeAssistantMessage([makeNavigateOutputPart("call_a")]),
    ];

    const { rerender } = renderHook(
      ({ msgs }: { msgs: UIMessage[] }) =>
        useAgentIntentWatcher(msgs, CONV_ID),
      { initialProps: { msgs: messages } },
    );

    // Same array reference → same effect deps → no second run, but even
    // if we pass a fresh array with the same contents the toolCallId set
    // pins idempotency. Verify both: same ref then a new ref.
    rerender({ msgs: messages });
    rerender({
      msgs: [makeAssistantMessage([makeNavigateOutputPart("call_a")])],
    });

    expect(navigateToContentMock).toHaveBeenCalledTimes(1);
    expect(navigateToContentMock).toHaveBeenCalledWith({
      kind: "articles",
      slug: "hello-world",
      href: "/@rick-rubin/articles/hello-world",
    });
  });

  it("(b) dispatches zero additional times after unmount + remount with the same persisted messages", () => {
    const messages = [
      makeAssistantMessage([makeNavigateOutputPart("call_b")]),
    ];

    const first = renderHook(() => useAgentIntentWatcher(messages, CONV_ID));
    expect(navigateToContentMock).toHaveBeenCalledTimes(1);

    first.unmount();

    // Simulate the chat panel reopening: a fresh mount of the hook with
    // the same persisted messages array. With mount-scoped state this
    // would re-dispatch; with the module Map it must not.
    renderHook(() => useAgentIntentWatcher(messages, CONV_ID));

    expect(navigateToContentMock).toHaveBeenCalledTimes(1);
  });

  it("(c) does not dispatch when the tool part is in `input-streaming`", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-navigateToContent",
          state: "input-streaming",
          toolCallId: "call_streaming",
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, CONV_ID));

    expect(navigateToContentMock).not.toHaveBeenCalled();
  });

  it("(d) does not dispatch when the tool part is in `output-error`", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-navigateToContent",
          state: "output-error",
          toolCallId: "call_error",
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, CONV_ID));

    expect(navigateToContentMock).not.toHaveBeenCalled();
  });

  it("(e) does not dispatch when output-available but output payload is malformed", () => {
    // The `isNavigateOutput` guard requires `kind`, `slug`, `title`, and
    // `href` fields. A malformed payload (here: `kind` only — missing
    // `slug`/`title`/`href`) must be skipped silently; otherwise the
    // dispatcher would receive `undefined` slug/href and either no-op or
    // navigate to a 404. Belt-and-suspenders for the runtime narrowing
    // that the broader `@convex-dev/agent` part type doesn't enforce.
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-navigateToContent",
          state: "output-available",
          toolCallId: "call_malformed",
          output: { kind: "articles" },
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, "conv_test_malformed"));

    expect(navigateToContentMock).not.toHaveBeenCalled();
  });

  it("(f) dispatches each toolCallId exactly once when an assistant turn carries two", () => {
    const messages = [
      makeAssistantMessage([
        makeNavigateOutputPart("call_e1", "first-slug"),
        makeNavigateOutputPart("call_e2", "second-slug"),
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, CONV_ID));

    expect(navigateToContentMock).toHaveBeenCalledTimes(2);
    expect(navigateToContentMock).toHaveBeenNthCalledWith(1, {
      kind: "articles",
      slug: "first-slug",
      href: "/@rick-rubin/articles/first-slug",
    });
    expect(navigateToContentMock).toHaveBeenNthCalledWith(2, {
      kind: "articles",
      slug: "second-slug",
      href: "/@rick-rubin/articles/second-slug",
    });
  });

  for (const section of ["bio", "articles", "posts"] as const) {
    it(`dispatches navigateToProfileSection when a tool-openProfileSection { section: ${section} } output-available part lands`, () => {
      // Profile-tabs parity: the watcher must recognize
      // `tool-openProfileSection` parts and route them through
      // `useCloneActions().navigateToProfileSection` with the server-built
      // href. Mirrors the navigateToContent contract so a future regression
      // that forgets to handle the new tool type fails this assertion
      // loudly.
      const href = `/@rick-rubin/${section}`;
      const messages = [
        makeAssistantMessage([
          {
            type: "tool-openProfileSection",
            state: "output-available",
            toolCallId: `call_open_${section}`,
            output: {
              kind: section,
              href,
              hasEntries: true,
            },
          },
        ]),
      ];

      renderHook(() =>
        useAgentIntentWatcher(messages, `conv_open_${section}`),
      );

      expect(navigateToProfileSectionMock).toHaveBeenCalledTimes(1);
      expect(navigateToProfileSectionMock).toHaveBeenCalledWith({
        section,
        href,
      });
      // Negative control — navigateToContent must not fire.
      expect(navigateToContentMock).not.toHaveBeenCalled();
    });
  }

  it("dispatches openProfileSection once per toolCallId across re-render and remount", () => {
    // Mirrors tests (a) and (b) for navigateToContent. The `handled` set is
    // shared and type-agnostic in production today, so this assertion pins
    // the contract for the openProfileSection path — a future refactor
    // that moves `handled.add` into per-type branches cannot regress
    // section idempotency without failing this test.
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-openProfileSection",
          state: "output-available",
          toolCallId: "call_open_section_idem",
          output: {
            kind: "bio",
            href: "/@rick-rubin/bio",
            hasEntries: true,
          },
        },
      ]),
    ];

    const first = renderHook(() =>
      useAgentIntentWatcher(messages, "conv_section_idem"),
    );
    expect(navigateToProfileSectionMock).toHaveBeenCalledTimes(1);

    first.unmount();
    renderHook(() => useAgentIntentWatcher(messages, "conv_section_idem"));

    expect(navigateToProfileSectionMock).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch openProfileSection when output payload is malformed (kind missing or wrong)", () => {
    // Defense-in-depth: the runtime narrowing in
    // `isOpenProfileSectionOutput` must reject any output that doesn't
    // include a recognized `kind` and a non-empty `href` string. A typo
    // in the server-side return shape would otherwise route the visitor
    // to `/undefined` and a 404.
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-openProfileSection",
          state: "output-available",
          toolCallId: "call_open_section_malformed",
          output: { hasEntries: true },
        },
        {
          type: "tool-openProfileSection",
          state: "output-available",
          toolCallId: "call_open_section_wrong_kind",
          // `clone-settings` is not in the visitor-visible enum, so the
          // narrowing must reject it even though the dispatcher's section
          // type is wider.
          output: {
            kind: "clone-settings",
            href: "/@rick-rubin/clone-settings",
            hasEntries: false,
          },
        },
      ]),
    ];

    renderHook(() =>
      useAgentIntentWatcher(messages, "conv_section_malformed"),
    );

    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("isolates handled toolCallIds per conversationId", () => {
    // Belt-and-suspenders: a regression here would mean the Map's
    // conversationId key has fallen back to a global bucket and the
    // cross-conversation isolation is broken.
    const messages = [
      makeAssistantMessage([makeNavigateOutputPart("call_shared_id")]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, CONV_ID));
    expect(navigateToContentMock).toHaveBeenCalledTimes(1);

    // Same toolCallId, different conversation → still dispatches in the
    // new conversation's bucket. (This is the rare case where two
    // conversations happen to share an opaque id; in practice they
    // won't, but the per-conversation isolation must hold either way.)
    renderHook(() => useAgentIntentWatcher(messages, CONV_ID_2));
    expect(navigateToContentMock).toHaveBeenCalledTimes(2);
  });
});
