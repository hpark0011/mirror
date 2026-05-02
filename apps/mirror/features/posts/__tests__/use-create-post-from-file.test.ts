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

    await act(async () => {
      await result.current.createPost({
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
  });

  it("when the action itself throws, createPost does NOT throw — synthetic failure recorded", async () => {
    mockCreate.mockResolvedValue("post_id_throws");
    mockImportAction.mockRejectedValue(new Error("Not authorized"));

    const { result } = renderHook(() => useCreatePostFromFile());

    let didThrow = false;
    await act(async () => {
      try {
        await result.current.createPost({
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
  });
});
