// FR-11: Inline image hook rejects disallowed MIME and oversize files BEFORE
// touching any Convex API. The mocks below intentionally throw if any Convex
// call is reached during a rejection scenario, so a regression that drops the
// pre-check would fail loudly. Mirror of the articles hook test — keep the
// structure identical so divergence between articles/posts surfaces is
// visible in code review.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGenerateUploadUrl = vi.fn();
const mockConvexQuery = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockGenerateUploadUrl,
  useConvex: () => ({ query: mockConvexQuery }),
}));

const mockUploadToStorage = vi.fn();
vi.mock("@/lib/upload-to-storage", () => ({
  uploadToStorage: (url: string, file: File) => mockUploadToStorage(url, file),
}));

// Import after mocks so the hook picks them up.
const { usePostInlineImageUpload } = await import(
  "../hooks/use-post-inline-image-upload"
);
const { InlineImageValidationError } = await import(
  "@/lib/inline-image-validation"
);

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("usePostInlineImageUpload (FR-11)", () => {
  beforeEach(() => {
    mockGenerateUploadUrl.mockReset();
    mockConvexQuery.mockReset();
    mockUploadToStorage.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a GIF (disallowed MIME) without calling any Convex API", async () => {
    const { result } = renderHook(() => usePostInlineImageUpload());
    const gif = makeFile("anim.gif", "image/gif", 1024);

    await act(async () => {
      await expect(result.current.upload(gif)).rejects.toBeInstanceOf(
        InlineImageValidationError,
      );
    });

    // Verify the trust-boundary contract: NO Convex calls were attempted.
    expect(mockGenerateUploadUrl).not.toHaveBeenCalled();
    expect(mockUploadToStorage).not.toHaveBeenCalled();
    expect(mockConvexQuery).not.toHaveBeenCalled();
  });

  it("rejects a 6 MiB PNG (oversize) without calling any Convex API", async () => {
    const { result } = renderHook(() => usePostInlineImageUpload());
    const sixMib = 6 * 1024 * 1024;
    const big = makeFile("huge.png", "image/png", sixMib);

    await act(async () => {
      await expect(result.current.upload(big)).rejects.toBeInstanceOf(
        InlineImageValidationError,
      );
    });

    expect(mockGenerateUploadUrl).not.toHaveBeenCalled();
    expect(mockUploadToStorage).not.toHaveBeenCalled();
    expect(mockConvexQuery).not.toHaveBeenCalled();
  });

  it("uses code='mime' for an unsupported MIME type", async () => {
    const { result } = renderHook(() => usePostInlineImageUpload());
    const gif = makeFile("anim.gif", "image/gif", 1024);

    await act(async () => {
      try {
        await result.current.upload(gif);
        throw new Error("upload should have rejected");
      } catch (err) {
        expect(err).toBeInstanceOf(InlineImageValidationError);
        expect((err as InlineImageValidationError).code).toBe("mime");
      }
    });
  });

  it("uses code='size' for a file larger than the policy", async () => {
    const { result } = renderHook(() => usePostInlineImageUpload());
    const sixMib = 6 * 1024 * 1024;
    const big = makeFile("huge.png", "image/png", sixMib);

    await act(async () => {
      try {
        await result.current.upload(big);
        throw new Error("upload should have rejected");
      } catch (err) {
        expect(err).toBeInstanceOf(InlineImageValidationError);
        expect((err as InlineImageValidationError).code).toBe("size");
      }
    });
  });

  it("accepts a 4 MiB WEBP and returns { storageId, url }", async () => {
    mockGenerateUploadUrl.mockResolvedValue("https://upload.example/url");
    mockUploadToStorage.mockResolvedValue("storage_abc" as never);
    mockConvexQuery.mockResolvedValue("https://convex.example/blob.webp");

    const { result } = renderHook(() => usePostInlineImageUpload());
    const fourMib = 4 * 1024 * 1024;
    const file = makeFile("ok.webp", "image/webp", fourMib);

    let value: { storageId: string; url: string } | null = null;
    await act(async () => {
      value = (await result.current.upload(file)) as unknown as {
        storageId: string;
        url: string;
      };
    });

    expect(value).toEqual({
      storageId: "storage_abc",
      url: "https://convex.example/blob.webp",
    });
    expect(mockGenerateUploadUrl).toHaveBeenCalledTimes(1);
    expect(mockUploadToStorage).toHaveBeenCalledWith(
      "https://upload.example/url",
      file,
    );
    expect(mockConvexQuery).toHaveBeenCalledTimes(1);
  });
});
