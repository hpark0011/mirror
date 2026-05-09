// Pins the cover-clear-on-save flow:
//   - handleCoverClear flips an internal `isCoverCleared` flag
//   - on save, `update` is called with `clearCoverImage: true` (an explicit
//     removal signal) — NOT `coverImageStorageId: undefined` masquerading as
//     "no change"
//   - a fresh upload after clear suppresses the clear flag (upload wins)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockUpdate = vi.fn();
const mockUploadCover = vi.fn();
const mockUploadCoverVideo = vi.fn();
const mockReplace = vi.fn();
const mockShowToast = vi.fn();
const mockRefresh = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("update")) return mockUpdate;
    return vi.fn();
  },
}));

vi.mock("../use-article-cover-image-upload", () => ({
  useArticleCoverImageUpload: () => ({ upload: mockUploadCover }),
}));

vi.mock("../use-article-cover-video-upload", () => ({
  useArticleCoverVideoUpload: () => ({ upload: mockUploadCoverVideo }),
}));

vi.mock("../use-article-inline-image-upload", () => ({
  useArticleInlineImageUpload: () => ({ upload: vi.fn() }),
}));

vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    articles: {
      mutations: {
        update: "articles.mutations.update",
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockReplace,
    refresh: mockRefresh,
  }),
  useParams: () => ({ username: "test-user" }),
}));

vi.mock("@feel-good/ui/components/toast", () => ({
  showToast: (opts: unknown) => {
    mockShowToast(opts);
  },
}));

const { useEditArticleForm } = await import("../use-edit-article-form");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Tiptap doc shape, not worth importing the full type
const SAMPLE_BODY: any = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ArticleWithBody shape, irrelevant to mutation-arg assertions
const INITIAL_ARTICLE: any = {
  _id: "article_existing",
  _creationTime: 1,
  userId: "user_1",
  slug: "existing-piece",
  title: "Existing Piece",
  coverImageUrl: "https://example.com/cover.png",
  createdAt: 1,
  publishedAt: undefined,
  status: "draft" as const,
  category: "Process",
  body: SAMPLE_BODY,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ArticleWithBody shape, irrelevant to mutation-arg assertions
const INITIAL_ARTICLE_WITH_VIDEO: any = {
  ...INITIAL_ARTICLE,
  coverImageUrl: null,
  coverImageThumbhash: undefined,
  coverVideoUrl: "https://example.com/cover.mp4",
  coverVideoPosterUrl: "https://example.com/poster.jpg",
};

describe("useEditArticleForm — cover clear", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUploadCover.mockReset();
    mockUploadCoverVideo.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockShowToast.mockReset();
    // Required by the upload-then-clear test below; harmless to the
    // tests that don't call handleCoverUpload.
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((file: Blob) =>
        file.type.startsWith("video/") ? "blob:video-url" : "blob:image-url",
      ),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("save sends clearCoverImage:true (not coverImageStorageId:undefined) after a clear", async () => {
    mockUpdate.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    act(() => {
      result.current.handleCoverClear();
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0]![0] as {
      id: string;
      clearCoverImage?: boolean;
      coverImageStorageId?: unknown;
    };
    expect(args.clearCoverImage).toBe(true);
    // Important: when clearing, the storageId field should be omitted —
    // it's not the removal signal. The server distinguishes "cleared" from
    // "no change" via `clearCoverImage`, not via undefined-vs-present.
    expect(args.coverImageStorageId).toBeUndefined();
  });

  it("save sends clearCoverImage:true with no video ids when video cover is cleared", async () => {
    mockUpdate.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE_WITH_VIDEO,
      }),
    );

    act(() => {
      result.current.handleCoverClear();
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0]![0] as {
      clearCoverImage?: boolean;
      coverImageStorageId?: unknown;
      coverVideoStorageId?: unknown;
      coverVideoPosterStorageId?: unknown;
    };
    expect(args.clearCoverImage).toBe(true);
    expect(args.coverImageStorageId).toBeUndefined();
    expect(args.coverVideoStorageId).toBeUndefined();
    expect(args.coverVideoPosterStorageId).toBeUndefined();
  });

  // FG_201: pins the storage-id reset path inside handleCoverClear that the
  // server-cover-then-clear test above cannot reach. The hook initializes
  // coverVideoStorageId / coverVideoPosterStorageId to null unconditionally
  // (use-edit-article-form.tsx:71-76), so the only way to get non-null
  // storage-id state into the hook is the upload path. Without first
  // uploading, handleCoverClear's setCoverVideoStorageId(null) /
  // setCoverVideoPosterStorageId(null) calls are observable no-ops.
  it("save sends clearCoverImage:true with no video ids after upload-then-clear", async () => {
    mockUpdate.mockResolvedValue(null);
    mockUploadCoverVideo.mockResolvedValue({
      videoStorageId: "video_storage_id",
      posterStorageId: "poster_storage_id",
    });
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.mp4", { type: "video/mp4" }),
      );
    });

    act(() => {
      result.current.handleCoverClear();
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0]![0] as {
      clearCoverImage?: boolean;
      coverVideoStorageId?: unknown;
      coverVideoPosterStorageId?: unknown;
    };
    expect(args.clearCoverImage).toBe(true);
    expect(args.coverVideoStorageId).toBeUndefined();
    expect(args.coverVideoPosterStorageId).toBeUndefined();
  });

  it("does not resend clearCoverImage after a failed clear-cover save", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("Network dropped"));
    mockUpdate.mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    act(() => {
      result.current.handleCoverClear();
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0]![0]).toMatchObject({
      clearCoverImage: true,
    });
    expect(mockShowToast).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setTitle("Retried Title Only");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const retryArgs = mockUpdate.mock.calls[1]![0] as {
      clearCoverImage?: boolean;
    };
    expect(retryArgs.clearCoverImage).toBeUndefined();
  });

  it("save without a clear omits clearCoverImage entirely", async () => {
    mockUpdate.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0]![0] as {
      clearCoverImage?: boolean;
      coverImageStorageId?: unknown;
    };
    // No-op for cover: neither field should be present.
    expect(args.clearCoverImage).toBeUndefined();
    expect(args.coverImageStorageId).toBeUndefined();
  });

  it("upload after clear wins — save sends the new storageId, no clear flag", async () => {
    mockUpdate.mockResolvedValue(null);
    mockUploadCover.mockResolvedValue({ storageId: "new_storage_id", thumbhash: "" });
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    act(() => {
      result.current.handleCoverClear();
    });

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    await act(async () => {
      await result.current.save();
    });

    const args = mockUpdate.mock.calls[0]![0] as {
      clearCoverImage?: boolean;
      coverImageStorageId?: unknown;
    };
    expect(args.clearCoverImage).toBeUndefined();
    expect(args.coverImageStorageId).toBe("new_storage_id");
  });

  // The two tests below pin the falsy-guard at use-edit-article-form.tsx:
  //   ...(coverImageThumbhash && { coverImageThumbhash })
  // If a future regression removes / inverts the guard, an empty string would
  // be persisted to the DB, and `thumbhashToDataUrl("")` returns null —
  // silent degradation with no LQIP. Lock the contract with a hook-level
  // assertion in both directions.
  it("upload with thumbhash forwards coverImageThumbhash to update", async () => {
    mockUpdate.mockResolvedValue(null);
    mockUploadCover.mockResolvedValue({
      storageId: "sid_y",
      thumbhash: "abc123==",
    });
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageThumbhash: "abc123==" }),
    );
  });

  it("upload with empty thumbhash omits coverImageThumbhash from update args", async () => {
    mockUpdate.mockResolvedValue(null);
    mockUploadCover.mockResolvedValue({ storageId: "sid_x", thumbhash: "" });
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        // Strip the seeded thumbhash so the save can only pick up what the
        // upload returned — otherwise the initial-article default would mask
        // the falsy-guard regression we're trying to lock down.
        initial: { ...INITIAL_ARTICLE, coverImageThumbhash: undefined },
      }),
    );

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ coverImageThumbhash: expect.anything() }),
    );
  });
});

describe("useEditArticleForm — cover-kind mutual exclusion", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUploadCover.mockReset();
    mockUploadCoverVideo.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockShowToast.mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((file: Blob) =>
        file.type.startsWith("video/") ? "blob:video-url" : "blob:image-url",
      ),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uploading a video after an image clears the image cover state", async () => {
    mockUpdate.mockResolvedValue(null);
    mockUploadCover.mockResolvedValue({
      storageId: "image_storage_id",
      thumbhash: "abc=",
    });
    mockUploadCoverVideo.mockResolvedValue({
      videoStorageId: "video_storage_id",
      posterStorageId: "poster_storage_id",
    });
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });
    expect(result.current.coverImageUrl).toBe("blob:image-url");

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.mp4", { type: "video/mp4" }),
      );
    });
    expect(result.current.coverImageUrl).toBeNull();
    expect(result.current.coverVideoUrl).toBe("blob:video-url");

    await act(async () => {
      await result.current.save();
    });

    const args = mockUpdate.mock.calls[0]![0] as {
      coverImageStorageId?: unknown;
      coverVideoStorageId?: unknown;
      coverVideoPosterStorageId?: unknown;
    };
    expect(args.coverImageStorageId).toBeUndefined();
    expect(args.coverVideoStorageId).toBe("video_storage_id");
    expect(args.coverVideoPosterStorageId).toBe("poster_storage_id");
  });

  it("uploading an image after a video clears the video cover state", async () => {
    mockUpdate.mockResolvedValue(null);
    mockUploadCoverVideo.mockResolvedValue({
      videoStorageId: "video_storage_id",
      posterStorageId: "poster_storage_id",
    });
    mockUploadCover.mockResolvedValue({
      storageId: "image_storage_id",
      thumbhash: "abc=",
    });
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE_WITH_VIDEO,
      }),
    );

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.mp4", { type: "video/mp4" }),
      );
    });
    expect(result.current.coverVideoUrl).toBe("blob:video-url");

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });
    expect(result.current.coverVideoUrl).toBeNull();
    expect(result.current.coverVideoPosterUrl).toBeNull();
    expect(result.current.coverImageUrl).toBe("blob:image-url");

    await act(async () => {
      await result.current.save();
    });

    const args = mockUpdate.mock.calls[0]![0] as {
      coverImageStorageId?: unknown;
      coverVideoStorageId?: unknown;
      coverVideoPosterStorageId?: unknown;
    };
    expect(args.coverImageStorageId).toBe("image_storage_id");
    expect(args.coverVideoStorageId).toBeUndefined();
    expect(args.coverVideoPosterStorageId).toBeUndefined();
  });
});

describe("useEditArticleForm — cancel", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUploadCover.mockReset();
    mockUploadCoverVideo.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigates to the original slug even after the slug field has been edited", () => {
    // Cancel must use `initial.slug`, never the editable form-state slug.
    // Otherwise an unsaved slug edit would route the user to a 404.
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    act(() => {
      result.current.setSlug("edited-slug");
    });

    act(() => {
      result.current.cancel();
    });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const target = mockReplace.mock.calls[0]![0] as string;
    expect(target).toContain("/existing-piece");
    expect(target).not.toContain("/edited-slug");
  });
});

describe("useEditArticleForm — publish status sync", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUploadCover.mockReset();
    mockUploadCoverVideo.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps RHF status in sync after a successful publish toggle", async () => {
    mockUpdate.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    await act(async () => {
      await result.current.togglePublish();
    });

    expect(mockUpdate.mock.calls[0]![0]).toMatchObject({
      status: "published",
    });
    expect(result.current.status).toBe("published");

    await act(async () => {
      await result.current.save();
    });

    expect(mockUpdate.mock.calls[1]![0]).toMatchObject({
      status: "published",
    });
  });
});

describe("useEditArticleForm — togglePublish validation", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUploadCover.mockReset();
    mockUploadCoverVideo.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Pins the dialog-stays-open contract for ArticlePublishToggle:
  // togglePublish must REJECT on validation failure (not silently resolve)
  // so the AlertDialog's catch keeps the dialog open. Resolving would close
  // the dialog while no row was actually published — a silent no-op.
  it("rejects when the form is invalid and surfaces an error toast", async () => {
    const invalidInitial = {
      ...INITIAL_ARTICLE,
      title: "",
    };
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: invalidInitial,
      }),
    );

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.togglePublish();
      } catch (err) {
        caught = err;
      }
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(caught).toBeInstanceOf(Error);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    expect(result.current.isSaving).toBe(false);
  });
});
