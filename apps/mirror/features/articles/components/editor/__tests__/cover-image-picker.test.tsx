import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoverImagePicker } from "../cover-image-picker";
import { CoverVideoPreview } from "../cover-video-preview";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function setUrlMethod(
  name: "createObjectURL" | "revokeObjectURL",
  value: unknown,
) {
  Object.defineProperty(URL, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreUrlMethod(
  name: "createObjectURL" | "revokeObjectURL",
  value: unknown,
) {
  if (value) {
    setUrlMethod(name, value);
    return;
  }
  Reflect.deleteProperty(URL, name);
}

function renderPicker(
  onUpload: (file: File) => Promise<{ kind: "image" | "video" }>,
  props: Partial<ComponentProps<typeof CoverImagePicker>> = {},
) {
  render(
    <CoverImagePicker
      imageUrl={null}
      videoUrl={null}
      videoPosterUrl={null}
      onUpload={onUpload}
      onClear={vi.fn()}
      {...props}
    />,
  );
}

function pickerInput() {
  return screen
    .getByTestId("article-cover-image-picker")
    .querySelector('input[type="file"]') as HTMLInputElement;
}

describe("CoverImagePicker", () => {
  beforeEach(() => {
    setUrlMethod(
      "createObjectURL",
      vi.fn(() => "blob:cover-video"),
    );
    setUrlMethod("revokeObjectURL", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    restoreUrlMethod("createObjectURL", originalCreateObjectURL);
    restoreUrlMethod("revokeObjectURL", originalRevokeObjectURL);
  });

  it("does not revoke the picker blob URL after a successful upload", async () => {
    const onUpload = vi.fn(
      async (): Promise<{ kind: "video" }> => ({
        kind: "video",
      }),
    );
    const file = new File([new Uint8Array([1])], "cover.mp4", {
      type: "video/mp4",
    });

    renderPicker(onUpload);
    await act(async () => {
      fireEvent.change(pickerInput(), { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        screen
          .getByTestId("article-cover-image-picker")
          .getAttribute("data-cover-upload-state"),
      ).toBe("ready"),
    );
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.getByTestId("article-cover-video-preview")).toBeTruthy();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes the picker blob URL when upload rejects", async () => {
    const onUpload = vi.fn(async () => {
      throw new Error("upload failed");
    });
    const file = new File([new Uint8Array([1])], "cover.mp4", {
      type: "video/mp4",
    });

    renderPicker(onUpload);
    fireEvent.change(pickerInput(), { target: { files: [file] } });

    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover-video"),
    );
  });

  it("uses the parent preparing state for data state, disabled controls, and label", () => {
    const onUpload = vi.fn(
      async (): Promise<{ kind: "image" }> => ({
        kind: "image",
      }),
    );

    renderPicker(onUpload, { coverUploadState: "preparing" });

    const picker = screen.getByTestId("article-cover-image-picker");
    const button = screen.getByRole("button", {
      name: "Preparing…",
    }) as HTMLButtonElement;
    expect(picker.getAttribute("data-cover-upload-state")).toBe("preparing");
    expect(button.disabled).toBe(true);
    expect(pickerInput().disabled).toBe(true);
  });

  it("uses the parent uploading state for active-cover replace label", () => {
    const onUpload = vi.fn(
      async (): Promise<{ kind: "image" }> => ({
        kind: "image",
      }),
    );

    renderPicker(onUpload, {
      coverUploadState: "uploading",
      imageUrl: "/cover.jpg",
    });

    const picker = screen.getByTestId("article-cover-image-picker");
    const replace = screen.getByRole("button", {
      name: "Uploading…",
    }) as HTMLButtonElement;
    expect(picker.getAttribute("data-cover-upload-state")).toBe("uploading");
    expect(replace.disabled).toBe(true);
  });
});

describe("CoverVideoPreview", () => {
  it("preserves the article cover video preview contract", () => {
    render(
      <CoverVideoPreview url="blob:cover-video" posterUrl="/poster.jpg" />,
    );

    const preview = screen.getByTestId(
      "article-cover-video-preview",
    ) as HTMLVideoElement;
    expect(preview.getAttribute("src")).toBe("blob:cover-video");
    expect(preview.getAttribute("poster")).toBe("/poster.jpg");
    expect(preview.getAttribute("preload")).toBe("metadata");
    expect(preview.autoplay).toBe(true);
    expect(preview.loop).toBe(true);
    expect(preview.muted).toBe(true);
    expect(preview.hasAttribute("playsinline")).toBe(true);
  });
});
