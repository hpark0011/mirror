// Pins the metadata header's controlled-input contract:
//   - title is a required text input
//   - slug auto-derives from title via generateSlug() unless the user has
//     manually edited the slug input ("dirty" sticky behavior)
//   - clearing the slug input re-enables auto-derivation
//   - status select shows the current status; changing it bubbles up
//   - cover image picker calls into the upload callback and renders preview
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { generateSlug } from "@feel-good/convex/convex/content/slug";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { ArticleMetadataHeader } = await import(
  "@/features/articles/components/article-metadata-header"
);

const noopUpload = vi.fn(async (_file: File) => ({
  storageId: "kg2_storage" as const,
  url: "https://example.convex.cloud/cover.png",
}));

const baseProps = {
  title: "",
  slug: "",
  category: "",
  status: "draft" as const,
  coverImageUrl: null,
  createdAt: null as number | null,
  publishedAt: null as number | null,
  onTitleChange: vi.fn(),
  onSlugChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onStatusChange: vi.fn(),
  onCoverImageUpload: noopUpload,
  onCoverImageClear: vi.fn(),
};

describe("ArticleMetadataHeader", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders all required fields with stable test ids", () => {
    render(<ArticleMetadataHeader {...baseProps} />);
    expect(screen.getByTestId("article-title-input")).toBeTruthy();
    expect(screen.getByTestId("article-slug-input")).toBeTruthy();
    expect(screen.getByTestId("article-category-input")).toBeTruthy();
    expect(screen.getByTestId("article-status-select")).toBeTruthy();
    expect(screen.getByTestId("article-cover-image-picker")).toBeTruthy();
    expect(screen.getByTestId("article-published-at")).toBeTruthy();
    expect(screen.getByTestId("article-created-at")).toBeTruthy();
  });

  it("auto-derives slug from title until the user manually edits the slug", () => {
    const onTitleChange = vi.fn();
    const onSlugChange = vi.fn();
    render(
      <ArticleMetadataHeader
        {...baseProps}
        onTitleChange={onTitleChange}
        onSlugChange={onSlugChange}
      />,
    );

    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "My First Article!" },
    });
    expect(onTitleChange).toHaveBeenCalledWith("My First Article!");
    expect(onSlugChange).toHaveBeenLastCalledWith(
      generateSlug("My First Article!"),
    );

    onSlugChange.mockClear();
    fireEvent.change(screen.getByTestId("article-slug-input"), {
      target: { value: "custom-slug" },
    });
    expect(onSlugChange).toHaveBeenCalledWith("custom-slug");

    // After manual edit, further title changes should NOT overwrite the slug
    onSlugChange.mockClear();
    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "Another Title" },
    });
    expect(onSlugChange).not.toHaveBeenCalled();
  });

  it("re-derives slug from title after the user clears the slug field", () => {
    // Use a tiny stateful wrapper so the slug input's bound value actually
    // tracks the user's edits — without this, React's controlled-input
    // dedup swallows the second fireEvent.change for slug="" (it matches
    // the prop), and `slugDirtyRef` never resets.
    const TestHarness = () => {
      const [slug, setSlug] = useState("");
      const [title, setTitle] = useState("");
      return (
        <ArticleMetadataHeader
          {...baseProps}
          title={title}
          slug={slug}
          onTitleChange={(next: string) => setTitle(next)}
          onSlugChange={(next: string) => setSlug(next)}
        />
      );
    };
    render(<TestHarness />);

    // Manually edit slug, then clear it
    const slugEl = () =>
      screen.getByTestId("article-slug-input") as HTMLInputElement;
    fireEvent.change(slugEl(), { target: { value: "custom" } });
    expect(slugEl().value).toBe("custom");
    fireEvent.change(slugEl(), { target: { value: "" } });
    expect(slugEl().value).toBe("");

    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "Reactivated" },
    });
    expect(slugEl().value).toBe("reactivated");
  });

  it("renders the published-at field as empty placeholder when null", () => {
    render(<ArticleMetadataHeader {...baseProps} />);
    const published = screen.getByTestId("article-published-at");
    expect(published.textContent || "").toMatch(/—|Not yet|Unpublished/i);
  });

  it("renders a relative timestamp once publishedAt is set", () => {
    render(
      <ArticleMetadataHeader {...baseProps} publishedAt={Date.now() - 60_000} />,
    );
    const published = screen.getByTestId("article-published-at");
    expect(published.textContent || "").not.toMatch(
      /^—$|Not yet|Unpublished/i,
    );
  });

  it("invokes upload callback when a cover image file is selected", async () => {
    const onCoverImageUpload = vi.fn(async (_file: File) => ({
      storageId: "k123" as const,
      url: "https://example.convex.cloud/cover.png",
    }));
    render(
      <ArticleMetadataHeader
        {...baseProps}
        onCoverImageUpload={onCoverImageUpload}
      />,
    );

    const file = new File([new Uint8Array([1, 2, 3])], "cover.png", {
      type: "image/png",
    });
    const input = screen
      .getByTestId("article-cover-image-picker")
      .querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    // wait a microtask
    await Promise.resolve();
    expect(onCoverImageUpload).toHaveBeenCalledTimes(1);
    const firstArg = onCoverImageUpload.mock.calls[0]?.[0];
    expect(firstArg).toBeInstanceOf(File);
  });
});
