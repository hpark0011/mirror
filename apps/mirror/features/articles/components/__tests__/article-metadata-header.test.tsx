// Pins the metadata header's RHF-bound contract:
//   - title, slug, category render via FormField/FormMessage
//   - slug auto-derives from title via generateSlug() unless the user has
//     manually edited the slug input ("dirty" sticky behavior)
//   - clearing the slug input re-enables auto-derivation
//   - validation errors surface as <FormMessage /> after a failed submit
//   - cover image picker calls into the upload callback and renders preview
// Publish/unpublish lives in the workspace toolbar, not here.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  useForm,
  useWatch,
  type Control,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import {
  articleMetadataSchema,
  type ArticleMetadataFormData,
} from "@/features/articles/lib/schemas/article-metadata.schema";

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
  "@/features/articles/components/editor/article-metadata-header"
);

const noopUpload = vi.fn(async (_file: File) => ({
  storageId: "kg2_storage" as const,
  thumbhash: "",
  url: "https://example.convex.cloud/cover.png",
}));

type HarnessProps = {
  initialValues?: Partial<ArticleMetadataFormData>;
  onCoverImageUpload?: (file: File) => Promise<{
    storageId: string;
    thumbhash: string;
    url: string;
  }>;
  publishedAt?: number | null;
  onFormReady?: (form: UseFormReturn<ArticleMetadataFormData>) => void;
};

function TestHarness({
  initialValues,
  onCoverImageUpload,
  publishedAt = null,
  onFormReady,
}: HarnessProps) {
  const form = useForm<ArticleMetadataFormData>({
    resolver: zodResolver(articleMetadataSchema),
    defaultValues: {
      title: "",
      slug: "",
      category: "",
      status: "draft",
      ...initialValues,
    },
  });
  // Hand the form back to the test so it can drive `form.handleSubmit` and
  // assert validation state without leaking RHF wiring into every test.
  useEffect(() => {
    onFormReady?.(form);
  }, [form, onFormReady]);
  return (
    <>
      <SlugReader control={form.control} />
      <ArticleMetadataHeader
        form={form}
        coverImageUrl={null}
        createdAt={null}
        publishedAt={publishedAt}
        onCoverImageUpload={onCoverImageUpload ?? noopUpload}
        onCoverImageClear={vi.fn()}
      />
    </>
  );
}

// Subscribed read of the slug field via `useWatch` (instead of `form.watch`)
// so the React Compiler / `react-hooks/incompatible-library` lint doesn't
// flag the test as it does in production code.
function SlugReader({ control }: { control: Control<ArticleMetadataFormData> }) {
  const slug = useWatch({ control, name: "slug" }) ?? "";
  return <div data-testid="watched-slug">{slug}</div>;
}

describe("ArticleMetadataHeader", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders all required fields with stable test ids", () => {
    render(<TestHarness />);
    expect(screen.getByTestId("article-title-input")).toBeTruthy();
    expect(screen.getByTestId("article-slug-input")).toBeTruthy();
    expect(screen.getByTestId("article-category-input")).toBeTruthy();
    expect(screen.getByTestId("article-cover-image-picker")).toBeTruthy();
    expect(screen.getByTestId("article-published-at")).toBeTruthy();
    expect(screen.getByTestId("article-created-at")).toBeTruthy();
  });

  it("auto-derives slug from title until the user manually edits the slug", () => {
    render(<TestHarness />);

    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "My First Article!" },
    });
    expect(screen.getByTestId("watched-slug").textContent).toBe(
      generateSlug("My First Article!"),
    );

    // Manual edit pins the slug
    fireEvent.change(screen.getByTestId("article-slug-input"), {
      target: { value: "custom-slug" },
    });
    expect(screen.getByTestId("watched-slug").textContent).toBe("custom-slug");

    // After manual edit, further title changes must NOT overwrite the slug
    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "Another Title" },
    });
    expect(screen.getByTestId("watched-slug").textContent).toBe("custom-slug");
  });

  it("does NOT auto-derive slug when mounting with an existing slug (edit-mode)", () => {
    // Editing the title of an already-published article must not silently
    // rename its slug. The dirty-ref must initialise from the slug value.
    render(
      <TestHarness
        initialValues={{ title: "Existing Title", slug: "existing-slug" }}
      />,
    );

    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "Updated Title" },
    });
    expect(screen.getByTestId("watched-slug").textContent).toBe(
      "existing-slug",
    );
  });

  it("re-derives slug from title after the user clears the slug field", () => {
    render(<TestHarness />);
    const slugEl = () =>
      screen.getByTestId("article-slug-input") as HTMLInputElement;

    // Manually edit slug, then clear it
    fireEvent.change(slugEl(), { target: { value: "custom" } });
    expect(slugEl().value).toBe("custom");
    fireEvent.change(slugEl(), { target: { value: "" } });
    expect(slugEl().value).toBe("");

    // Title change after clear must re-engage auto-derive
    fireEvent.change(screen.getByTestId("article-title-input"), {
      target: { value: "Reactivated" },
    });
    expect(slugEl().value).toBe("reactivated");
  });

  it("renders the published-at field as empty placeholder when null", () => {
    render(<TestHarness />);
    const published = screen.getByTestId("article-published-at");
    expect(published.textContent || "").toMatch(/—|Not yet|Unpublished/i);
  });

  it("renders a relative timestamp once publishedAt is set", () => {
    render(<TestHarness publishedAt={Date.now() - 60_000} />);
    const published = screen.getByTestId("article-published-at");
    expect(published.textContent || "").not.toMatch(
      /^—$|Not yet|Unpublished/i,
    );
  });

  it("invokes upload callback when a cover image file is selected", async () => {
    const onCoverImageUpload = vi.fn(async (_file: File) => ({
      storageId: "k123" as const,
      thumbhash: "",
      url: "https://example.convex.cloud/cover.png",
    }));
    render(<TestHarness onCoverImageUpload={onCoverImageUpload} />);

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

  // FG_127: the whole point of wiring through RHF + zodResolver is to surface
  // validation messages in the UI. Pin that here so a future regression that
  // drops `<FormMessage />` (or skips wiring `errors` through) fails loudly.
  it("renders schema error messages via <FormMessage /> after a failed submit", async () => {
    let capturedForm: UseFormReturn<ArticleMetadataFormData> | undefined;
    render(
      <TestHarness
        onFormReady={(f) => {
          capturedForm = f;
        }}
      />,
    );
    expect(capturedForm).toBeDefined();

    // Trigger the resolver with empty title and category. Async because the
    // zodResolver runs on submit.
    await act(async () => {
      await capturedForm!.handleSubmit(
        () => {},
        () => {},
      )();
    });

    expect(
      screen.getByTestId("article-title-error").textContent,
    ).toMatch(/Title is required/i);
    expect(
      screen.getByTestId("article-category-error").textContent,
    ).toMatch(/Category is required/i);
  });
});
