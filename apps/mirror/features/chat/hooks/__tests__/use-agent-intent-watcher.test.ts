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
import { type UIMessage } from "@convex-dev/agent/react";

const navigateToContentMock = vi.fn();
const navigateToProfileSectionMock = vi.fn();

vi.mock("@/app/[username]/_providers/clone-actions-context", () => ({
  useCloneActions: () => ({
    navigateToContent: navigateToContentMock,
    navigateToProfileSection: navigateToProfileSectionMock,
  }),
}));

// Import after the mock so the hook picks up the mocked provider.
const { useAgentIntentWatcher, handledByConversation } =
  await import("@/features/chat/hooks/use-agent-intent-watcher");

const CONV_ID = "conv_test_1";
const CONV_ID_2 = "conv_test_2";

type ToolPart = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
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
    const messages = [makeAssistantMessage([makeNavigateOutputPart("call_a")])];

    const { rerender } = renderHook(
      ({ msgs }: { msgs: UIMessage[] }) => useAgentIntentWatcher(msgs, CONV_ID),
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
    const messages = [makeAssistantMessage([makeNavigateOutputPart("call_b")])];

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

      renderHook(() => useAgentIntentWatcher(messages, `conv_open_${section}`));

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

    // Same-mount re-render must not re-dispatch — the per-conversation
    // `handled` set is the in-mount idempotency boundary.
    first.rerender();
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

    renderHook(() => useAgentIntentWatcher(messages, "conv_section_malformed"));

    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("dispatches existing profile-section navigation after configuration Bio and Contact patch tools", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-applyBioEntryPatch",
          state: "output-available",
          toolCallId: "call_apply_bio",
          output: {
            section: "bio",
            href: "/@rick-rubin/bio",
            applied: { created: 1, updated: 0, deleted: 0 },
          },
        },
        {
          type: "tool-applyContactEntryPatch",
          state: "output-available",
          toolCallId: "call_apply_contact",
          output: {
            section: "contact",
            href: "/@rick-rubin/contact",
            applied: { upserted: 1, deleted: 0 },
          },
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, "conv_config_patch"));

    expect(navigateToProfileSectionMock).toHaveBeenCalledTimes(2);
    expect(navigateToProfileSectionMock).toHaveBeenNthCalledWith(1, {
      section: "bio",
      href: "/@rick-rubin/bio",
    });
    expect(navigateToProfileSectionMock).toHaveBeenNthCalledWith(2, {
      section: "contact",
      href: "/@rick-rubin/contact",
    });
    expect(navigateToContentMock).not.toHaveBeenCalled();
  });

  it("does not dispatch read-only configuration tools or malformed patch outputs", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-getProfileConfiguration",
          state: "output-available",
          toolCallId: "call_read_config",
          output: {
            bioHref: "/@rick-rubin/bio",
            contactHref: "/@rick-rubin/contact",
          },
        },
        {
          type: "tool-fetchProfileSource",
          state: "output-available",
          toolCallId: "call_fetch_source",
          output: {
            status: "available",
            text: "resume text",
          },
        },
        {
          type: "tool-applyBioEntryPatch",
          state: "output-available",
          toolCallId: "call_bad_patch",
          output: {
            section: "bio",
            href: "/@rick-rubin/bio",
            applied: { created: "one" },
          },
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, "conv_config_readonly"));

    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
    expect(navigateToContentMock).not.toHaveBeenCalled();
  });

  it("routes applyContentPatch with a created draft to the editHref via navigateToContent", () => {
    // PLAN_013: draft create/update should hand off to the editor route
    // so the owner can review the agent-generated body before publishing.
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-applyContentPatch",
          state: "output-available",
          toolCallId: "call_content_create_draft",
          output: {
            results: [
              {
                action: "create",
                kind: "posts",
                slug: "agent-draft",
                status: "draft",
                href: "/@rick-rubin/posts/agent-draft",
                editHref: "/@rick-rubin/posts/agent-draft/edit",
              },
            ],
            applied: { created: 1, updated: 0, deleted: 0 },
            lastTouched: {
              kind: "posts",
              slug: "agent-draft",
              status: "draft",
              href: "/@rick-rubin/posts/agent-draft",
              editHref: "/@rick-rubin/posts/agent-draft/edit",
              action: "create",
            },
            lastDeleted: null,
          },
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, "conv_content_create"));

    expect(navigateToContentMock).toHaveBeenCalledTimes(1);
    expect(navigateToContentMock).toHaveBeenCalledWith({
      kind: "posts",
      slug: "agent-draft",
      href: "/@rick-rubin/posts/agent-draft/edit",
    });
    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("routes applyContentPatch with a published update to the detail href via navigateToContent", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-applyContentPatch",
          state: "output-available",
          toolCallId: "call_content_update_published",
          output: {
            results: [
              {
                action: "update",
                kind: "articles",
                slug: "published-piece",
                status: "published",
                href: "/@rick-rubin/articles/published-piece",
                editHref: "/@rick-rubin/articles/published-piece/edit",
              },
            ],
            applied: { created: 0, updated: 1, deleted: 0 },
            lastTouched: {
              kind: "articles",
              slug: "published-piece",
              status: "published",
              href: "/@rick-rubin/articles/published-piece",
              editHref: "/@rick-rubin/articles/published-piece/edit",
              action: "update",
            },
            lastDeleted: null,
          },
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, "conv_content_update"));

    expect(navigateToContentMock).toHaveBeenCalledWith({
      kind: "articles",
      slug: "published-piece",
      href: "/@rick-rubin/articles/published-piece",
    });
    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("routes applyContentPatch delete-only to navigateToProfileSection", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-applyContentPatch",
          state: "output-available",
          toolCallId: "call_content_delete",
          output: {
            results: [
              {
                action: "delete",
                kind: "posts",
                slug: "removed-post",
                deleted: true,
                href: "/@rick-rubin/posts",
              },
            ],
            applied: { created: 0, updated: 0, deleted: 1 },
            lastTouched: null,
            lastDeleted: {
              kind: "posts",
              slug: "removed-post",
              href: "/@rick-rubin/posts",
            },
          },
        },
      ]),
    ];

    renderHook(() => useAgentIntentWatcher(messages, "conv_content_delete"));

    expect(navigateToProfileSectionMock).toHaveBeenCalledTimes(1);
    expect(navigateToProfileSectionMock).toHaveBeenCalledWith({
      section: "posts",
      href: "/@rick-rubin/posts",
    });
    expect(navigateToContentMock).not.toHaveBeenCalled();
  });

  it("does not dispatch for read-only content tools (getProfileContentLibrary / getProfileContentForEdit)", () => {
    // Read-only tools must not trigger navigation — the agent uses them
    // to gather state before deciding whether to call `applyContentPatch`.
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-getProfileContentLibrary",
          state: "output-available",
          toolCallId: "call_content_library",
          output: {
            username: "rick-rubin",
            listHrefs: {
              posts: "/@rick-rubin/posts",
              articles: "/@rick-rubin/articles",
            },
            items: [],
          },
        },
        {
          type: "tool-getProfileContentForEdit",
          state: "output-available",
          toolCallId: "call_content_for_edit",
          output: {
            found: true,
            kind: "posts",
            slug: "some-post",
            title: "Some post",
            bodyText: "Body",
            bodyBlocks: [],
            href: "/@rick-rubin/posts/some-post",
            editHref: "/@rick-rubin/posts/some-post/edit",
          },
        },
      ]),
    ];

    renderHook(() =>
      useAgentIntentWatcher(messages, "conv_content_readonly"),
    );

    expect(navigateToContentMock).not.toHaveBeenCalled();
    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("does not dispatch when applyContentPatch output is malformed", () => {
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-applyContentPatch",
          state: "output-available",
          toolCallId: "call_content_malformed",
          output: {
            applied: { created: "one" },
            lastTouched: null,
            lastDeleted: null,
          },
        },
      ]),
    ];

    renderHook(() =>
      useAgentIntentWatcher(messages, "conv_content_malformed"),
    );

    expect(navigateToContentMock).not.toHaveBeenCalled();
    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("leaves the user in place when applyContentPatch reports no rows touched", () => {
    // The watcher's routing: if lastTouched exists, navigate to the row.
    // If lastDeleted exists, navigate to the section list. Otherwise, no-op.
    // This test pins the no-op path: a valid output shape where both
    // lastTouched and lastDeleted are null (e.g., a delete-only patch
    // where all slugs already vanished).
    const messages = [
      makeAssistantMessage([
        {
          type: "tool-applyContentPatch",
          state: "output-available",
          toolCallId: "call_content_noop",
          output: {
            results: [],
            applied: { created: 0, updated: 0, deleted: 0 },
            lastTouched: null,
            lastDeleted: null,
          },
        },
      ]),
    ];

    renderHook(() =>
      useAgentIntentWatcher(messages, "conv_content_noop"),
    );

    expect(navigateToContentMock).not.toHaveBeenCalled();
    expect(navigateToProfileSectionMock).not.toHaveBeenCalled();
  });

  it("(g) bounded-walk: dispatch count does not grow when pre-existing messages re-render without new tool calls", () => {
    // Seeds 10 assistant messages that each carry one already-handled
    // navigateToContent part, then adds one new message with a fresh
    // tool call. On the first render all 10 fire; on a subsequent
    // re-render with the same 10 messages (different array ref to
    // force a new effect run), the scan must start at index 10 and
    // dispatch exactly 0 additional times — i.e., the bounded walk
    // skips the already-scanned history.
    const history: UIMessage[] = Array.from({ length: 10 }, (_, idx) =>
      makeAssistantMessage([makeNavigateOutputPart(`call_hist_${idx}`, `slug-${idx}`)]),
    );

    const { rerender } = renderHook(
      ({ msgs }: { msgs: UIMessage[] }) => useAgentIntentWatcher(msgs, CONV_ID),
      { initialProps: { msgs: history } },
    );

    // First render: all 10 historical tool calls fire.
    expect(navigateToContentMock).toHaveBeenCalledTimes(10);

    // Re-render with a new array reference but the same 10 messages.
    // The bounded-walk must not re-enter any of them.
    const sameLengthNewRef = [...history];
    rerender({ msgs: sameLengthNewRef });
    expect(navigateToContentMock).toHaveBeenCalledTimes(10);

    // Now append a new message with a fresh tool call.
    const withNewMsg = [
      ...history,
      makeAssistantMessage([makeNavigateOutputPart("call_hist_new", "slug-new")]),
    ];
    rerender({ msgs: withNewMsg });

    // Only the single new tool call should have fired.
    expect(navigateToContentMock).toHaveBeenCalledTimes(11);
    expect(navigateToContentMock).toHaveBeenLastCalledWith({
      kind: "articles",
      slug: "slug-new",
      href: "/@rick-rubin/articles/slug-new",
    });
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
