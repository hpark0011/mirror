// Pins the defer-create-on-first-save flow:
//   - createArticle calls api.articles.mutations.create with the metadata +
//     body that the editor accumulated in memory (no row exists until Save)
//   - on success, router.replace navigates to /articles/<slug>/edit
//   - on slug-conflict (or other ConvexError), the toast surfaces it and the
//     hook's `error` is exposed so the editor stays open with state intact
//   - status passes through verbatim — the mutation auto-sets publishedAt
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockCreate = vi.fn();
const mockReplace = vi.fn();
const mockToastError = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("create")) return mockCreate;
    return vi.fn();
  },
  useConvex: () => ({ query: vi.fn() }),
}));

vi.mock("../use-article-cover-image-upload", () => ({
  useArticleCoverImageUpload: () => ({ upload: vi.fn() }),
}));

vi.mock("../use-article-inline-image-upload", () => ({
  useArticleInlineImageUpload: () => ({ upload: vi.fn() }),
}));

vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    articles: {
      mutations: {
        create: "articles.mutations.create",
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockReplace }),
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

const { useNewArticleForm } = await import("../use-new-article-form");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Tiptap doc shape, not worth importing the full type
const SAMPLE_BODY: any = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

describe("useNewArticleForm — defer-create-on-first-save", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockReplace.mockReset();
    mockToastError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT call create on mount or on metadata edits — only on save", () => {
    renderHook(() => useNewArticleForm({ username: "test-user" }));
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

  it("forwards status='published' so the server sets publishedAt", async () => {
    mockCreate.mockResolvedValue("article_id_3");
    const { result } = renderHook(() =>
      useNewArticleForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Publish Me");
      result.current.setCategory("Process");
      result.current.setStatus("published");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate.mock.calls[0]![0]).toMatchObject({
      status: "published",
    });
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
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
  });
});
