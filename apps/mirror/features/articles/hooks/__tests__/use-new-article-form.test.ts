// Pins the defer-create-on-first-save flow:
//   - createArticle calls api.articles.mutations.create with the metadata +
//     body that the editor accumulated in memory (no row exists until Save)
//   - on success, router.replace navigates to /articles/<slug>/edit
//   - on slug-conflict (or other ConvexError), the toast surfaces it and the
//     hook's `error` is exposed so the editor stays open with state intact
//   - status passes through verbatim — the mutation auto-sets publishedAt
//   - FG_129: on create failure with a cover uploaded, deleteOrphanCoverImage
//     is called with the storageId so the orphan blob is cleaned up eagerly
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockCreate = vi.fn();
const mockDeleteOrphanCoverImage = vi.fn();
const mockReplace = vi.fn();
const mockShowToast = vi.fn();
// Mutable upload spy — tests can call mockUploadCover.mockResolvedValue(...).
const mockUploadCover = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("deleteOrphan")) return mockDeleteOrphanCoverImage;
    if (s.includes("create")) return mockCreate;
    return vi.fn();
  },
  useConvex: () => ({ query: vi.fn() }),
}));

vi.mock("../use-article-cover-image-upload", () => ({
  useArticleCoverImageUpload: () => ({ upload: mockUploadCover }),
}));

vi.mock("../use-article-cover-video-upload", () => ({
  useArticleCoverVideoUpload: () => ({ upload: vi.fn() }),
}));

vi.mock("../use-article-inline-image-upload", () => ({
  useArticleInlineImageUpload: () => ({ upload: vi.fn() }),
}));

vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    articles: {
      mutations: {
        create: "articles.mutations.create",
        deleteOrphanCoverImage: "articles.mutations.deleteOrphanCoverImage",
        deleteOrphanCoverVideo: "articles.mutations.deleteOrphanCoverVideo",
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockReplace }),
  useParams: () => ({ username: "test-user" }),
}));

vi.mock("@feel-good/ui/components/toast", () => ({
  showToast: (opts: unknown) => {
    mockShowToast(opts);
  },
}));

const { useNewArticleForm } = await import("../use-new-article-form");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Tiptap doc shape, not worth importing the full type
const SAMPLE_BODY: any = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

describe("useNewArticleForm — defer-create-on-first-save", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockDeleteOrphanCoverImage.mockReset();
    mockReplace.mockReset();
    mockShowToast.mockReset();
    mockUploadCover.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT call create on mount or on metadata edits — only on save", () => {
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );
    expect(mockCreate).not.toHaveBeenCalled();

    // Editing every metadata field must NOT fire create — the deferred-
    // create contract is the most distinctive promise of the new-article
    // flow. Abandoning the page leaves no trace in the DB.
    act(() => {
      result.current.setTitle("foo");
      result.current.setSlug("foo-bar");
      result.current.setCategory("cat");
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls create with all metadata + body and redirects to /<slug>/edit on success", async () => {
    mockCreate.mockResolvedValue("article_id_1");
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("My New Piece");
      result.current.setCategory("Process");
      result.current.setBody(SAMPLE_BODY);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0]![0] as {
      title: string;
      slug: string;
      category: string;
      body: unknown;
      status: "draft" | "published";
      coverImageStorageId?: string;
    };
    expect(args.title).toBe("My New Piece");
    expect(args.category).toBe("Process");
    expect(args.body).toEqual(SAMPLE_BODY);
    expect(args.status).toBe("draft");
    expect(args.slug).toBe("my-new-piece");

    expect(mockReplace).toHaveBeenCalledWith(
      "/@test-user/articles/my-new-piece/edit",
    );
  });

  it("forwards a manually-edited slug verbatim", async () => {
    mockCreate.mockResolvedValue("article_id_2");
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Whatever");
      result.current.setSlug("custom-route");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate.mock.calls[0]![0]).toMatchObject({
      slug: "custom-route",
    });
    expect(mockReplace).toHaveBeenCalledWith(
      "/@test-user/articles/custom-route/edit",
    );
  });

  it("togglePublish flips draft→published and forwards status='published' to create", async () => {
    mockCreate.mockResolvedValue("article_id_3");
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Publish Me");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.togglePublish();
    });

    expect(mockCreate.mock.calls[0]![0]).toMatchObject({
      status: "published",
    });
    expect(result.current.status).toBe("published");
  });

  it("on rejection, surfaces a toast and does NOT navigate; isSaving resets", async () => {
    mockCreate.mockRejectedValue(new Error("Slug already exists"));
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Conflict");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    expect(result.current.isSaving).toBe(false);
  });

  // Pin the falsy-guard at use-new-article-form.tsx:
  //   ...(coverImageThumbhash && { coverImageThumbhash })
  // If a future regression removes / inverts the guard, an empty string
  // would be persisted — and `thumbhashToDataUrl("")` returns null, so the
  // detail view silently degrades to no LQIP placeholder. Lock both
  // directions at the hook-level args boundary.
  it("upload with thumbhash forwards coverImageThumbhash to create", async () => {
    mockCreate.mockResolvedValue("article_id_4");
    mockUploadCover.mockResolvedValue({ storageId: "sid_y", thumbhash: "xyz=" });
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("With Thumbhash");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ coverImageThumbhash: "xyz=" }),
    );
  });

  it("upload with empty thumbhash omits coverImageThumbhash from create args", async () => {
    mockCreate.mockResolvedValue("article_id_5");
    mockUploadCover.mockResolvedValue({ storageId: "sid_x", thumbhash: "" });
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Degraded");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ coverImageThumbhash: expect.anything() }),
    );
  });
});

describe("useNewArticleForm — RHF validation", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockDeleteOrphanCoverImage.mockReset();
    mockReplace.mockReset();
    mockShowToast.mockReset();
    mockUploadCover.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("save with an empty title does not call create and exposes a title error", async () => {
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    // Category is set but title is left empty (default "").
    act(() => {
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.save();
    });

    // Validation blocked the mutation.
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    // The schema's title error message is surfaced through the hook's
    // `errors` accessor — the metadata header reads the same RHF state via
    // `<FormField>` / `<FormMessage>`.
    expect(result.current.errors.title?.message).toBe("Title is required");
  });

  it("save with an empty category does not call create and exposes a category error", async () => {
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    // Title is set but category is left empty.
    act(() => {
      result.current.setTitle("Some Article");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.errors.category?.message).toBe(
      "Category is required",
    );
  });
});

describe("useNewArticleForm — FG_129 cover-image orphan cleanup", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockDeleteOrphanCoverImage.mockReset();
    mockUploadCover.mockReset();
    mockReplace.mockReset();
    mockShowToast.mockReset();
    // Stub URL.createObjectURL / revokeObjectURL so the hook can run in jsdom
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:fake-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls deleteOrphanCoverImage with the storageId when create fails after cover upload", async () => {
    mockUploadCover.mockResolvedValue({ storageId: "storage_id_abc", thumbhash: "" });
    mockCreate.mockRejectedValue(new Error("An article with slug already exists"));
    mockDeleteOrphanCoverImage.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("My Article");
      result.current.setCategory("Process");
    });

    // Simulate cover upload — this populates coverImageStorageId in state
    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    // Now save — create will fail
    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockDeleteOrphanCoverImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteOrphanCoverImage).toHaveBeenCalledWith({
      storageId: "storage_id_abc",
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does NOT call deleteOrphanCoverImage when create fails without a cover upload", async () => {
    mockCreate.mockRejectedValue(new Error("An article with slug already exists"));
    mockDeleteOrphanCoverImage.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("No Cover Article");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockDeleteOrphanCoverImage).not.toHaveBeenCalled();
  });

  // Pins the retry-after-orphan-cleanup invariant: once the orphan delete is
  // enqueued, the local cover reference must be cleared. Otherwise a retry
  // (e.g. user fixes the slug and saves again) re-sends a storageId whose
  // bytes the orphan-sweep mutation has already deleted, persisting a
  // dangling cover reference.
  it("clears local cover state when orphan cleanup is scheduled", async () => {
    mockUploadCover.mockResolvedValue({ storageId: "storage_id_def", thumbhash: "" });
    mockCreate.mockRejectedValue(new Error("An article with slug already exists"));
    mockDeleteOrphanCoverImage.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Will Fail");
      result.current.setCategory("Process");
    });

    await act(async () => {
      await result.current.handleCoverUpload(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" }),
      );
    });

    // Sanity: cover state populated before the failed save.
    expect(result.current.coverImageUrl).not.toBeNull();

    await act(async () => {
      await result.current.save();
    });

    expect(mockDeleteOrphanCoverImage).toHaveBeenCalledTimes(1);
    // After orphan cleanup is scheduled the local cover reference is wiped
    // so a retry (with a corrected slug) must re-upload.
    expect(result.current.coverImageUrl).toBeNull();
  });
});

describe("useNewArticleForm — togglePublish validation", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockDeleteOrphanCoverImage.mockReset();
    mockReplace.mockReset();
    mockShowToast.mockReset();
    mockUploadCover.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Pins the dialog-stays-open contract for ArticlePublishToggle:
  // togglePublish must REJECT on validation failure (not silently resolve)
  // so the AlertDialog's catch keeps the dialog open. Resolving would close
  // the dialog while no row was actually created — a silent no-op publish.
  it("rejects when the form is invalid and surfaces an error toast", async () => {
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    // Title left empty (default ""), category set — schema requires both.
    act(() => {
      result.current.setCategory("Process");
    });

    let caught: unknown = null;
    await act(async () => {
      try {
        await result.current.togglePublish();
      } catch (err) {
        caught = err;
      }
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(caught).toBeInstanceOf(Error);
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    expect(result.current.isSaving).toBe(false);
  });
});
