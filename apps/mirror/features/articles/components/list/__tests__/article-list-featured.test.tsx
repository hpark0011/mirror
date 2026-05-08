// Pins the featured article list rendering contract:
//   - empty `articles` array renders nothing (no container in the DOM)
//   - one article renders one card using the title-first variant
//   - FeaturedArticleCard with no coverImageUrl omits the <img> and does not
//     crash (the imageBlock conditional return path)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type ArticleSummary } from "@/features/articles/types";

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
    placeholder: _placeholder,
    blurDataURL: _blur,
    sizes: _sizes,
    ...rest
  } = props;
  return rest;
}

vi.mock("@/hooks/use-chat-search-params", () => ({
  useChatSearchParams: () => ({
    buildChatAwareHref: (path: string) => path,
  }),
}));

vi.mock("@/app/[username]/_providers/clone-actions-context", () => ({
  useCloneActions: () => ({
    navigateToContent: vi.fn(),
  }),
}));

let intersectionObservers: MockIntersectionObserver[] = [];
let videoPlayMock: ReturnType<typeof vi.fn>;
let videoPauseMock: ReturnType<typeof vi.fn>;

class MockIntersectionObserver {
  readonly callback: IntersectionObserverCallback;
  readonly elements = new Set<Element>();
  readonly rootMargin: string;

  constructor(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.callback = callback;
    this.rootMargin = options.rootMargin ?? "";
    intersectionObservers.push(this);
  }

  observe = vi.fn((element: Element) => {
    this.elements.add(element);
  });

  unobserve = vi.fn((element: Element) => {
    this.elements.delete(element);
  });

  disconnect = vi.fn(() => {
    this.elements.clear();
  });

  takeRecords = vi.fn(() => []);

  trigger(isIntersecting: boolean, target = [...this.elements][0]) {
    if (!target) {
      throw new Error("MockIntersectionObserver has no observed target");
    }

    this.callback(
      [{ isIntersecting, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  intersectionObservers = [];
  videoPlayMock = vi.fn(() => Promise.resolve());
  videoPauseMock = vi.fn();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
    videoPlayMock,
  );
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
    videoPauseMock,
  );
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const { ArticleListFeatured } = await import(
  "@/features/articles/components/list/article-list-featured"
);
const { FeaturedArticleCard } = await import(
  "@/features/articles/components/list/article-list-featured-card"
);

function makeArticle(overrides: Partial<ArticleSummary> = {}): ArticleSummary {
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
    ...overrides,
  };
}

describe("ArticleListFeatured", () => {
  it("renders nothing when articles is empty", () => {
    const { container } = render(
      <ArticleListFeatured articles={[]} username="alice" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one card for a single article", () => {
    const articles = [
      makeArticle({ slug: "hello", title: "Hello World" }),
    ];
    render(<ArticleListFeatured articles={articles} username="alice" />);
    expect(screen.getByText("Hello World")).toBeDefined();
    // Exactly one anchor link rendered (one card).
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("FeaturedArticleCard", () => {
  it("renders no <img> when coverImageUrl is null", () => {
    const article = makeArticle({
      slug: "no-cover",
      title: "Coverless",
      coverImageUrl: null,
    });
    const { container } = render(
      <FeaturedArticleCard
        article={article}
        username="alice"
        variant="title-first"
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    // Title still renders — confirms the no-cover branch did not crash.
    expect(screen.getByText("Coverless")).toBeDefined();
  });

  it("renders an <img> when coverImageUrl is present", () => {
    const article = makeArticle({
      slug: "with-cover",
      title: "Has Cover",
      coverImageUrl: "https://example.com/cover.png",
    });
    const { container } = render(
      <FeaturedArticleCard
        article={article}
        username="alice"
        variant="image-first"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/cover.png");
  });

  it("renders a visibility-gated <video> when coverVideoUrl is set, even if coverImageUrl is also set", async () => {
    const article = makeArticle({
      slug: "with-video-cover",
      title: "Has Video Cover",
      coverImageUrl: "https://example.com/cover.png",
      coverVideoUrl: "https://example.com/cover.mp4",
      coverVideoPosterUrl: "https://example.com/poster.png",
    });
    const { container } = render(
      <FeaturedArticleCard
        article={article}
        username="alice"
        variant="image-first"
      />,
    );

    const video = screen.getByTestId(
      "article-list-cover-video",
    ) as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe("https://example.com/cover.mp4");
    expect(video.getAttribute("poster")).toBe("https://example.com/poster.png");
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("loop")).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.hasAttribute("muted")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(container.querySelector("img")).toBeNull();
    expect(videoPlayMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(intersectionObservers).toHaveLength(1);
    });

    await act(async () => {
      intersectionObservers[0]?.trigger(true, video);
    });

    expect(videoPlayMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      intersectionObservers[0]?.trigger(false, video);
    });

    expect(videoPauseMock).toHaveBeenCalled();
  });
});
