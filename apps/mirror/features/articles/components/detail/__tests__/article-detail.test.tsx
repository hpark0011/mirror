import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type ArticleWithBody } from "@/features/articles/types";

vi.mock("next/dynamic", () => ({
  default: () => function DynamicMock() {
    return <div data-testid="rich-text-viewer" />;
  },
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
    // Plain img so jsdom/happy-dom doesn't try to optimize. Strip
    // next-only props that would warn when applied to an <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} {...stripNextImageProps(props)} />
  ),
}));

function stripNextImageProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const {
    fill: _fill,
    priority: _priority,
    placeholder: _placeholder,
    blurDataURL: _blur,
    ...rest
  } = props;
  return rest;
}

const { ArticleDetail } = await import(
  "@/features/articles/components/detail/article-detail"
);

function makeArticle(
  overrides: Partial<ArticleWithBody> = {},
): ArticleWithBody {
  return {
    _id: "art_default" as Id<"articles">,
    _creationTime: 0,
    userId: "user_default" as Id<"users">,
    slug: "default-slug",
    title: "Default Title",
    coverImageUrl: null,
    coverImageThumbhash: null,
    coverVideoUrl: null,
    coverVideoPosterUrl: null,
    createdAt: 0,
    publishedAt: 1000,
    status: "published",
    category: "general",
    body: { type: "doc", content: [] },
    ...overrides,
  };
}

describe("ArticleDetail", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders <video> when coverVideoUrl is set, even if coverImageUrl is also set", () => {
    const article = makeArticle({
      title: "Has Video Cover",
      coverImageUrl: "https://example.com/cover.png",
      coverVideoUrl: "https://example.com/cover.mp4",
      coverVideoPosterUrl: "https://example.com/poster.png",
    });

    render(<ArticleDetail article={article} />);

    const video = screen.getByTestId(
      "article-detail-cover-video",
    ) as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("https://example.com/cover.mp4");
    expect(video.getAttribute("poster")).toBe("https://example.com/poster.png");
    expect(video.autoplay).toBe(true);
    expect(video.hasAttribute("autoplay")).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("loop")).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.hasAttribute("muted")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(screen.queryByTestId("article-detail-cover-image")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
