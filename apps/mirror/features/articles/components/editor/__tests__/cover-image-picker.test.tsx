// Pins the cover picker's temporary blob-preview lifecycle. The parent
// form hook owns the post-upload cover URL; the picker owns only the
// short-lived preview URL created while upload work is in flight.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { CoverImagePicker } from "@/features/articles/components/editor/cover-image-picker";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function installUrlMocks() {
  let nextId = 0;
  createObjectURL = vi.fn(() => {
    nextId += 1;
    return `blob:picker-preview-${nextId}`;
  });
  revokeObjectURL = vi.fn();

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
}

function restoreUrlMocks() {
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "createObjectURL");
  }

  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  } else {
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
}

function ControlledVideoPicker() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  return (
    <CoverImagePicker
      imageUrl={null}
      videoUrl={videoUrl}
      videoPosterUrl={null}
      onUpload={async () => {
        setVideoUrl("blob:parent-owned-video");
        return { kind: "video" };
      }}
      onClear={() => setVideoUrl(null)}
    />
  );
}

describe("CoverImagePicker", () => {
  beforeEach(() => {
    installUrlMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    restoreUrlMocks();
  });

  it("hands a successful video upload from the temporary preview URL to the parent-owned URL", async () => {
    render(<ControlledVideoPicker />);

    const input = screen
      .getByTestId("article-cover-image-picker")
      .querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], "cover.mp4", {
            type: "video/mp4",
          }),
        ],
      },
    });

    const preview = await screen.findByTestId("article-cover-video-preview");
    await waitFor(() => {
      expect(preview.getAttribute("src")).toBe("blob:parent-owned-video");
    });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:picker-preview-1");
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:parent-owned-video");
  });
});
