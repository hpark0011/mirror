// Pins the cover-clear-on-save flow:
//   - handleCoverImageClear flips an internal `isCoverCleared` flag
//   - on save, `update` is called with `clearCoverImage: true` (an explicit
//     removal signal) — NOT `coverImageStorageId: undefined` masquerading as
//     "no change"
//   - a fresh upload after clear suppresses the clear flag (upload wins)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockUpdate = vi.fn();
const mockUploadCover = vi.fn();
const mockReplace = vi.fn();
const mockToastError = vi.fn();
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

vi.mock("sonner", () => ({
  toast: {
    custom: (fn: (id: string) => unknown) => {
      mockToastError(fn);
      return "toast-id";
    },
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

describe("useEditArticleForm — cover clear", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUploadCover.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockToastError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      result.current.handleCoverImageClear();
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
    mockUploadCover.mockResolvedValue("new_storage_id");
    const { result } = renderHook(() =>
      useEditArticleForm({
        username: "test-user",
        initial: INITIAL_ARTICLE,
      }),
    );

    act(() => {
      result.current.handleCoverImageClear();
    });

    await act(async () => {
      await result.current.handleCoverImageUpload(
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
});
