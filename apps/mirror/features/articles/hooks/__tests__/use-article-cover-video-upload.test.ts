import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type UploadOptions = {
  signal?: AbortSignal;
};

const mocks = vi.hoisted(() => ({
  mutationRefs: {
    generateArticleCoverVideoUploadUrls:
      "articles.mutations.generateArticleCoverVideoUploadUrls",
    claimCoverVideoOwnership: "articles.mutations.claimCoverVideoOwnership",
    claimCoverVideoPosterOwnership:
      "articles.mutations.claimCoverVideoPosterOwnership",
    deleteOrphanCoverVideo: "articles.mutations.deleteOrphanCoverVideo",
  },
  generateUploadUrls: vi.fn(),
  claimVideoOwnership: vi.fn(),
  claimPosterOwnership: vi.fn(),
  deleteOrphanCoverVideo: vi.fn(),
  uploadToStorage: vi.fn(),
}));

vi.mock("@feel-good/convex/convex/_generated/api", () => ({
  api: {
    articles: {
      mutations: mocks.mutationRefs,
    },
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (mutation: string) => {
    switch (mutation) {
      case mocks.mutationRefs.generateArticleCoverVideoUploadUrls:
        return mocks.generateUploadUrls;
      case mocks.mutationRefs.deleteOrphanCoverVideo:
        return mocks.deleteOrphanCoverVideo;
      default:
        throw new Error(`Unexpected mutation: ${mutation}`);
    }
  },
  useAction: (action: string) => {
    switch (action) {
      case mocks.mutationRefs.claimCoverVideoOwnership:
        return mocks.claimVideoOwnership;
      case mocks.mutationRefs.claimCoverVideoPosterOwnership:
        return mocks.claimPosterOwnership;
      default:
        throw new Error(`Unexpected action: ${action}`);
    }
  },
}));

vi.mock("@/lib/upload-to-storage", () => ({
  uploadToStorage: (url: string, file: File, options?: UploadOptions) =>
    mocks.uploadToStorage(url, file, options),
}));

const { useArticleCoverVideoUpload } =
  await import("../use-article-cover-video-upload");

type PosterElementOptions = {
  videoWidth?: number;
  videoHeight?: number;
  fireSeeked?: boolean;
};

type CanvasRecord = {
  canvas: HTMLCanvasElement;
  drawImage: ReturnType<typeof vi.fn>;
};

function makeVideoFile(): File {
  return new File([new Uint8Array([1])], "cover.mp4", {
    type: "video/mp4",
  });
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve()
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined)
    .then(() => undefined);
}

function stubPosterElements({
  videoWidth = 1280,
  videoHeight = 720,
  fireSeeked = true,
}: PosterElementOptions = {}): { canvases: CanvasRecord[] } {
  const canvases: CanvasRecord[] = [];
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation(((
    tagName: string,
    options?: ElementCreationOptions,
  ) => {
    if (tagName === "video") {
      return makeMockVideo({ videoWidth, videoHeight, fireSeeked });
    }

    if (tagName === "canvas") {
      const canvas = originalCreateElement("canvas") as HTMLCanvasElement;
      const drawImage = vi.fn();
      Object.defineProperty(canvas, "getContext", {
        configurable: true,
        value: vi.fn(
          () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
        ),
      });
      Object.defineProperty(canvas, "toBlob", {
        configurable: true,
        value: vi.fn((callback: BlobCallback) => {
          callback(new Blob([new Uint8Array([1])], { type: "image/jpeg" }));
        }),
      });
      canvases.push({ canvas, drawImage });
      return canvas;
    }

    return originalCreateElement(tagName, options);
  }) as typeof document.createElement);

  return { canvases };
}

function makeMockVideo({
  videoWidth,
  videoHeight,
  fireSeeked,
}: Required<PosterElementOptions>): HTMLVideoElement {
  const video = new EventTarget() as HTMLVideoElement;
  let currentTime = 0;
  let metadataQueued = false;

  Object.defineProperties(video, {
    duration: { configurable: true, value: 1 },
    videoWidth: { configurable: true, value: videoWidth },
    videoHeight: { configurable: true, value: videoHeight },
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
        if (fireSeeked) {
          queueMicrotask(() => {
            video.dispatchEvent(new Event("seeked"));
          });
        }
      },
    },
  });

  const addEventListener = video.addEventListener.bind(video);
  vi.spyOn(video, "addEventListener").mockImplementation(((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    addEventListener(type, listener, options);
    if (type === "loadedmetadata" && !metadataQueued) {
      metadataQueued = true;
      queueMicrotask(() => {
        video.dispatchEvent(new Event("loadedmetadata"));
      });
    }
  }) as typeof video.addEventListener);

  return video;
}

describe("useArticleCoverVideoUpload", () => {
  beforeEach(() => {
    mocks.generateUploadUrls.mockReset();
    mocks.claimVideoOwnership.mockReset();
    mocks.claimPosterOwnership.mockReset();
    mocks.deleteOrphanCoverVideo.mockReset();
    mocks.uploadToStorage.mockReset();

    mocks.generateUploadUrls.mockResolvedValue({
      videoUrl: "video-upload-url",
      posterUrl: "poster-upload-url",
    });
    mocks.claimVideoOwnership.mockResolvedValue(null);
    mocks.claimPosterOwnership.mockResolvedValue(null);
    mocks.deleteOrphanCoverVideo.mockResolvedValue(null);
    mocks.uploadToStorage.mockImplementation((url: string) =>
      Promise.resolve(
        url === "video-upload-url" ? "video_storage_id" : "poster_storage_id",
      ),
    );

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:cover-video"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports preparing during poster extraction and uploading during transfer", async () => {
    const states: string[] = [];
    stubPosterElements();
    const { result } = renderHook(() =>
      useArticleCoverVideoUpload({
        onStateChange: (state) => {
          states.push(state);
        },
      }),
    );

    await act(async () => {
      await result.current.upload(makeVideoFile());
    });

    expect(states).toEqual(["preparing", "uploading"]);
    expect(mocks.generateUploadUrls).toHaveBeenCalledTimes(1);
    expect(mocks.uploadToStorage).toHaveBeenCalledTimes(2);
  });

  it("aborts the sibling video upload when the poster upload fails", async () => {
    stubPosterElements();
    let videoSignal: AbortSignal | undefined;

    mocks.uploadToStorage.mockImplementation(
      (url: string, _file: File, options?: UploadOptions) => {
        if (url === "video-upload-url") {
          videoSignal = options?.signal;
          return new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => {
                reject(new Error("video upload aborted"));
              },
              { once: true },
            );
          });
        }

        return Promise.reject(new Error("poster upload failed"));
      },
    );

    const { result } = renderHook(() => useArticleCoverVideoUpload());

    await act(async () => {
      await expect(result.current.upload(makeVideoFile())).rejects.toThrow(
        "poster upload failed",
      );
    });

    expect(videoSignal?.aborted).toBe(true);
    expect(mocks.deleteOrphanCoverVideo).not.toHaveBeenCalled();
  });

  it("cleans up a completed upload when its sibling upload fails", async () => {
    stubPosterElements();
    mocks.uploadToStorage.mockImplementation((url: string) => {
      if (url === "video-upload-url") {
        return Promise.resolve("video_storage_id");
      }

      return Promise.reject(new Error("poster upload failed"));
    });

    const { result } = renderHook(() => useArticleCoverVideoUpload());

    await act(async () => {
      await expect(result.current.upload(makeVideoFile())).rejects.toThrow(
        "poster upload failed",
      );
    });

    expect(mocks.deleteOrphanCoverVideo).toHaveBeenCalledWith({
      videoStorageId: "video_storage_id",
    });
  });

  it("times out a stalled poster seek and revokes the object URL", async () => {
    vi.useFakeTimers();
    stubPosterElements({ fireSeeked: false });
    const { result } = renderHook(() => useArticleCoverVideoUpload());

    const uploadPromise = result.current.upload(makeVideoFile());
    const rejection = expect(uploadPromise).rejects.toThrow(
      /timed out while waiting for seeked/,
    );

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(10_001);
    await rejection;

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover-video");
    expect(mocks.generateUploadUrls).not.toHaveBeenCalled();
    expect(mocks.uploadToStorage).not.toHaveBeenCalled();
  });

  it("clamps a 4K poster canvas to 1920x1080", async () => {
    const { canvases } = stubPosterElements({
      videoWidth: 3840,
      videoHeight: 2160,
    });
    const { result } = renderHook(() => useArticleCoverVideoUpload());

    await act(async () => {
      await result.current.upload(makeVideoFile());
    });

    expect(canvases[0]?.canvas.width).toBe(1920);
    expect(canvases[0]?.canvas.height).toBe(1080);
    expect(canvases[0]?.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1920,
      1080,
    );
  });

  it("does not upscale a portrait poster under the cap", async () => {
    const { canvases } = stubPosterElements({
      videoWidth: 720,
      videoHeight: 1280,
    });
    const { result } = renderHook(() => useArticleCoverVideoUpload());

    await act(async () => {
      await result.current.upload(makeVideoFile());
    });

    expect(canvases[0]?.canvas.width).toBe(720);
    expect(canvases[0]?.canvas.height).toBe(1280);
  });
});
