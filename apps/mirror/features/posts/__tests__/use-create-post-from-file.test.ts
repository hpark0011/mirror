// FR-08 invariant: after the markdown-import flow completes, post status
// MUST stay `draft`. The hook is the only client-side caller of
// `api.posts.mutations.create`, so this test pins:
//   1. status passed to `create` is "draft" (regardless of input)
//   2. NO second mutation is fired to bump status to "published"
//   3. `importStatus` settles to "done" with the spec's importResult shape
//   4. The public `importPostMarkdownInlineImages` action IS invoked once
//      with the new postId after create
//   5. If the action itself rejects, `createPost` does NOT throw — it
//      records a synthetic failure into `importResult` and lands in
//      `importStatus: "done"`
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUploadCoverImage = vi.fn();
const mockImportAction = vi.fn();

// Track which api reference was passed to useAction so we can assert that
// the hook wires the correct action (not just SOME action that returns
// the right shape).
const useActionRefs: unknown[] = [];

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    // The Convex `api.x.y.z` proxy stringifies to a path-like structure;
    // route to the right mock by inspecting the path.
    const s = String(ref);
    if (s.includes("create")) return mockCreate;
    if (s.includes("update")) return mockUpdate;
    return vi.fn();
  },
  useAction: (ref: unknown) => {
    useActionRefs.push(ref);
    return mockImportAction;
  },
}));

vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    posts: {
      mutations: {
        create: "posts.mutations.create",
        update: "posts.mutations.update",
      },
      inlineImages: {
        importPostMarkdownInlineImages:
          "posts.inlineImages.importPostMarkdownInlineImages",
      },
    },
  },
}));

vi.mock("../hooks/use-post-cover-image-upload", () => ({
  usePostCoverImageUpload: () => ({ upload: mockUploadCoverImage }),
}));

const { useCreatePostFromFile } = await import(
  "../hooks/use-create-post-from-file"
);

const SAMPLE_BODY = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
} as const;

describe("useCreatePostFromFile (FR-08)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockUploadCoverImage.mockReset();
    mockImportAction.mockReset();
    useActionRefs.length = 0;
    // Default: import action resolves cleanly with no work to do.
    mockImportAction.mockResolvedValue({
      imported: 0,
      failed: 0,
      failures: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forces status='draft' on create — even if the call site asks for something else later", async () => {
    mockCreate.mockResolvedValue("post_id_1");

    const { result } = renderHook(() => useCreatePostFromFile());

    await act(async () => {
      await result.current.createPost({
        title: "Hello",
        slug: "hello",
        category: "Other",
        body: SAMPLE_BODY,
      });
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreate.mock.calls[0]![0] as { status: string };
    expect(createArgs.status).toBe("draft");
  });

  it("does NOT auto-publish after import: no second mutation bumps status", async () => {
    mockCreate.mockResolvedValue("post_id_2");

    const { result } = renderHook(() => useCreatePostFromFile());

    await act(async () => {
      await result.current.createPost({
        title: "Stay Draft",
        slug: "stay-draft",
        category: "Other",
        body: SAMPLE_BODY,
      });
    });

    // Direct negative assertion: NO update call ever passes a status field
    // (whether or not update was called for cover image, etc.). Catches a
    // hypothetical regression where a third mutation is wired in to bump
    // status — the original loop-based assertion was vacuous when
    // mockUpdate had zero recorded calls.
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
    );
    // Two acceptable outcomes: zero update calls, or only update calls that
    // are NOT publishing. Belt-and-suspenders.
    for (const call of mockUpdate.mock.calls) {
      const args = call[0] as { status?: string };
      expect(args.status).toBeUndefined();
    }
  });

  it("invokes importPostMarkdownInlineImages exactly once with the new postId", async () => {
    mockCreate.mockResolvedValue("post_id_action");
    mockImportAction.mockResolvedValue({
      imported: 2,
      failed: 0,
      failures: [],
    });

    const { result } = renderHook(() => useCreatePostFromFile());

    await act(async () => {
      await result.current.createPost({
        title: "Action Run",
        slug: "action-run",
        category: "Other",
        body: SAMPLE_BODY,
      });
    });

    expect(mockImportAction).toHaveBeenCalledTimes(1);
    expect(mockImportAction).toHaveBeenCalledWith({ postId: "post_id_action" });
    // Pin the api reference: a refactor wiring `useAction` to a different
    // action (e.g., a mutation by mistake) would still produce the same
    // mocked function but the wrong path string. Assert the canonical path.
    expect(useActionRefs).toContain(
      "posts.inlineImages.importPostMarkdownInlineImages",
    );
    expect(result.current.importStatus).toBe("done");
    expect(result.current.importResult).toEqual({
      imported: 2,
      failed: 0,
      failures: [],
    });
  });

  it("surfaces partial failures from the action without throwing", async () => {
    mockCreate.mockResolvedValue("post_id_partial");
    mockImportAction.mockResolvedValue({
      imported: 1,
      failed: 1,
      failures: [{ src: "https://broken.example/x.png", reason: "http-error" }],
    });

    const { result } = renderHook(() => useCreatePostFromFile());

    let returned: Awaited<ReturnType<typeof result.current.createPost>> = null;
    await act(async () => {
      returned = await result.current.createPost({
        title: "Partial",
        slug: "partial",
        category: "Other",
        body: SAMPLE_BODY,
      });
    });

    expect(result.current.importStatus).toBe("done");
    expect(result.current.importResult).toEqual({
      imported: 1,
      failed: 1,
      failures: [{ src: "https://broken.example/x.png", reason: "http-error" }],
    });
    expect(returned).toEqual(result.current.importResult);
  });

  it("when the action itself throws, createPost does NOT throw — synthetic failure recorded", async () => {
    mockCreate.mockResolvedValue("post_id_throws");
    mockImportAction.mockRejectedValue(new Error("Not authorized"));

    const { result } = renderHook(() => useCreatePostFromFile());

    let didThrow = false;
    let returned: Awaited<ReturnType<typeof result.current.createPost>> = null;
    await act(async () => {
      try {
        returned = await result.current.createPost({
          title: "Action Failure",
          slug: "action-failure",
          category: "Other",
          body: SAMPLE_BODY,
        });
      } catch {
        didThrow = true;
      }
    });

    expect(didThrow).toBe(false);
    expect(result.current.importStatus).toBe("done");
    expect(result.current.importResult).toEqual({
      imported: 0,
      failed: 1,
      failures: [{ src: "(action error)", reason: "Not authorized" }],
    });
    expect(returned).toEqual(result.current.importResult);
  });

  // FG_100: closing the markdown-upload dialog mid-import must silence any
  // setState calls that follow the in-flight `importMarkdownInlineImages`
  // action. The Convex action itself can't be aborted, so cancellation is
  // a client-side guard only — server-side completion still runs.
  it("cancelImport() silences setImportResult/setImportStatus after the action resolves", async () => {
    mockCreate.mockResolvedValue("post_id_cancel");

    // Build a deferred so we control exactly when the action resolves.
    let resolveAction: (value: {
      imported: number;
      failed: number;
      failures: { src: string; reason: string }[];
    }) => void = () => {};
    mockImportAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    const { result } = renderHook(() => useCreatePostFromFile());

    // Kick off createPost but DON'T await it inside `act` — we need it to
    // hang on the action promise so we can assert mid-flight state.
    let createPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      createPromise = result.current.createPost({
        title: "Cancelled",
        slug: "cancelled",
        category: "Other",
        body: SAMPLE_BODY,
      });
      // Yield once so the synchronous setStates and the awaited
      // `create` mock (a resolved promise) flush before we sample state.
      await Promise.resolve();
      await Promise.resolve();
    });

    // Mid-import: the hook should be in `importing` and have no result yet.
    expect(result.current.importStatus).toBe("importing");
    expect(result.current.importResult).toBeNull();

    // Simulate the dialog's close path: cancel the in-flight import.
    act(() => {
      result.current.cancelImport();
    });

    // Now resolve the deferred action and let `createPost` unwind.
    await act(async () => {
      resolveAction({
        imported: 5,
        failed: 0,
        failures: [],
      });
      await createPromise;
    });

    // Post-cancel assertions: neither the success setStates nor the
    // `done` transition should have run. cancelImport itself resets
    // `importStatus` to "idle" so the dialog doesn't get stuck on
    // "importing"; importResult stays null because no post-await setStates
    // ran after cancellation.
    expect(result.current.importResult).toBeNull();
    expect(result.current.importStatus).toBe("idle");
    expect(result.current.isCreating).toBe(false);
  });

  // Companion case: after a real mid-flight cancellation, a SECOND
  // `createPost` on the same hook instance must run to completion. The
  // first call must actually be in flight when cancelImport fires —
  // otherwise we'd only be testing the no-op pre-cancel path, not the
  // cancelledRef-reset path that lets subsequent calls progress.
  it("createPost after a real mid-flight cancelImport runs to completion (cancelledRef resets per call)", async () => {
    mockCreate.mockResolvedValue("post_id_recovered");

    // First call: action hangs on a deferred so we can cancel mid-flight.
    let resolveFirst: (value: {
      imported: number;
      failed: number;
      failures: { src: string; reason: string }[];
    }) => void = () => {};
    mockImportAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { result } = renderHook(() => useCreatePostFromFile());

    // Kick off the first createPost; let it reach the awaiting-action state.
    let firstPromise: Promise<unknown> = Promise.resolve();
    await act(async () => {
      firstPromise = result.current.createPost({
        title: "Cancelled",
        slug: "cancelled",
        category: "Other",
        body: SAMPLE_BODY,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Confirm we're actually mid-flight before cancelling — otherwise this
    // test would silently degrade to the trivial pre-cancel case.
    expect(result.current.importStatus).toBe("importing");

    // Cancel mid-flight, then settle the first action so createPost
    // unwinds without running its post-await setStates.
    act(() => {
      result.current.cancelImport();
    });
    await act(async () => {
      resolveFirst({ imported: 0, failed: 0, failures: [] });
      await firstPromise;
    });

    // Second call: a fresh action that resolves cleanly. cancelledRef must
    // have been reset at the top of createPost, otherwise this call's
    // post-await setStates are silently dropped.
    mockImportAction.mockResolvedValueOnce({
      imported: 3,
      failed: 0,
      failures: [],
    });

    await act(async () => {
      await result.current.createPost({
        title: "Recovered",
        slug: "recovered",
        category: "Other",
        body: SAMPLE_BODY,
      });
    });

    expect(result.current.importStatus).toBe("done");
    expect(result.current.importResult).toEqual({
      imported: 3,
      failed: 0,
      failures: [],
    });
  });
});
