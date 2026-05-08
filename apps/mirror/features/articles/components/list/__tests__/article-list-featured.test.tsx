// Pins the featured article list rendering contract:
//   - empty `articles` array renders nothing (no container in the DOM)
//   - one article renders one card using the title-first variant
//   - FeaturedArticleCard with no coverImageUrl omits the <img> and does not
//     crash (the imageBlock conditional return path)
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  afterEach(() => {
    cleanup();
  });

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
  afterEach(() => {
    cleanup();
  });

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
});
