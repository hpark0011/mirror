// Pins the defer-create-on-first-save flow for the post editor (mirror of
// `articles/hooks/__tests__/use-new-article-form.test.ts`):
//   - create calls api.posts.mutations.create with the metadata + body that
//     the editor accumulated in memory (no row exists until Save)
//   - on success, router.replace navigates to /posts/<slug>/edit
//   - on slug conflict, the toast surfaces it and the editor stays open
//   - status passes through verbatim — the mutation auto-sets publishedAt
//   - FG_129 parity: on create failure with a cover uploaded,
//     deleteOrphanCoverImage is called so the orphan blob is cleaned up
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockCreate = vi.fn();
const mockDeleteOrphanCoverImage = vi.fn();
const mockDeleteOrphanCoverVideo = vi.fn();
const mockReplace = vi.fn();
const mockShowToast = vi.fn();
const mockUploadCover = vi.fn();
const mockUploadCoverVideo = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    const s = String(ref);
    if (s.includes("deleteOrphanCoverVideo")) {
      return mockDeleteOrphanCoverVideo;
    }
    if (s.includes("deleteOrphanCoverImage")) {
      return mockDeleteOrphanCoverImage;
    }
    if (s.includes("create")) return mockCreate;
    return vi.fn();
  },
  useConvex: () => ({ query: vi.fn() }),
}));

vi.mock("../use-post-cover-image-upload", () => ({
  usePostCoverImageUpload: () => ({ upload: mockUploadCover }),
}));

vi.mock("../use-post-cover-video-upload", () => ({
  usePostCoverVideoUpload: () => ({ upload: mockUploadCoverVideo }),
}));

vi.mock("../use-post-inline-image-upload", () => ({
  usePostInlineImageUpload: () => ({ upload: vi.fn() }),
}));

vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    posts: {
      mutations: {
        create: "posts.mutations.create",
        deleteOrphanCoverImage: "posts.mutations.deleteOrphanCoverImage",
        deleteOrphanCoverVideo: "posts.mutations.deleteOrphanCoverVideo",
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

const { useNewPostForm } = await import("../use-new-post-form");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Tiptap doc shape
const SAMPLE_BODY: any = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

describe("useNewPostForm — defer-create-on-first-save", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockDeleteOrphanCoverImage.mockReset();
    mockDeleteOrphanCoverVideo.mockReset();
    mockReplace.mockReset();
    mockShowToast.mockReset();
    mockUploadCover.mockReset();
    mockUploadCoverVideo.mockReset();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:image-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does NOT call create on mount or on metadata edits — only on save", () => {
    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );
    expect(mockCreate).not.toHaveBeenCalled();

    act(() => {
      result.current.setTitle("foo");
      result.current.setSlug("foo-bar");
      result.current.setCategory("cat");
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calls create with all metadata + body and redirects to /<slug>/edit on success", async () => {
    mockCreate.mockResolvedValue("post_id_1");
    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("My New Post");
      result.current.setCategory("Notes");
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
    expect(args.title).toBe("My New Post");
    expect(args.category).toBe("Notes");
    expect(args.body).toEqual(SAMPLE_BODY);
    expect(args.status).toBe("draft");
    expect(args.slug).toBe("my-new-post");

    expect(mockReplace).toHaveBeenCalledWith(
      "/@test-user/posts/my-new-post/edit",
    );
  });

  it("creates a titleless post when a manual slug is supplied", async () => {
    mockCreate.mockResolvedValue("post_id_titleless");
    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setSlug("body-only-post");
      result.current.setCategory("Notes");
      result.current.setBody(SAMPLE_BODY);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate.mock.calls[0]![0]).toMatchObject({
      title: "",
      slug: "body-only-post",
      category: "Notes",
      body: SAMPLE_BODY,
    });
    expect(mockReplace).toHaveBeenCalledWith(
      "/@test-user/posts/body-only-post/edit",
    );
  });

  it("requires a slug when saving a post without a title", async () => {
    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setCategory("Notes");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.current.errors.slug?.message).toBe(
      "Slug is required when title is empty",
    );
  });

  it("forwards a manually-edited slug verbatim", async () => {
    mockCreate.mockResolvedValue("post_id_2");
    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Whatever");
      result.current.setSlug("custom-route");
      result.current.setCategory("Notes");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockCreate.mock.calls[0]![0]).toMatchObject({
      slug: "custom-route",
    });
    expect(mockReplace).toHaveBeenCalledWith(
      "/@test-user/posts/custom-route/edit",
    );
  });

  it("togglePublish flips draft→published and forwards status='published' to create", async () => {
    mockCreate.mockResolvedValue("post_id_3");
    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Publish Me");
      result.current.setCategory("Notes");
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
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Conflict");
      result.current.setCategory("Notes");
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it("FG_129 parity: on create failure with a cover uploaded, fires deleteOrphanCoverImage", async () => {
    mockUploadCover.mockResolvedValue({
      storageId: "storage_orphan_1",
      thumbhash: "",
    });
    mockCreate.mockRejectedValue(new Error("Slug already exists"));

    const { result } = renderHook(() =>
      useNewPostForm({ username: "test-user" }),
    );

    act(() => {
      result.current.setTitle("Cover orphan");
      result.current.setCategory("Notes");
    });

    const file = new File([new Uint8Array([1])], "cover.png", {
      type: "image/png",
    });
    await act(async () => {
      await result.current.handleCoverUpload(file);
    });

    await act(async () => {
      await result.current.save();
    });

    expect(mockDeleteOrphanCoverImage).toHaveBeenCalledWith({
      storageId: "storage_orphan_1",
    });
  });
});
