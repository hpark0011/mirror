import matter from "gray-matter";
import {
  MAX_TITLE_LENGTH,
  MAX_SLUG_LENGTH,
} from "@feel-good/convex/convex/content/schema";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import {
  DEFAULT_POST_CATEGORY,
  MAX_POST_CATEGORY_LENGTH,
} from "@feel-good/convex/convex/posts/categories";

export type ParsedMarkdown = {
  title: string;
  slug: string;
  category: string;
  body: string;
};

type ParseError = {
  field: string;
  message: string;
};

type ParseResult =
  | { success: true; data: ParsedMarkdown }
  | { success: false; error: ParseError };

const MAX_FILE_SIZE = 512_000; // 500 KB

export function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".md")) {
    return "Only .md files are accepted";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File must be smaller than 500 KB";
  }
  return null;
}

export function parseMdFrontmatter(
  fileContent: string,
  fileName: string,
): ParseResult {
  let data: Record<string, unknown>;
  let content: string;
  try {
    const parsed = matter(fileContent, {
      engines: {
        javascript: {
          parse: () => {
            throw new Error("JavaScript front matter is not supported");
          },
        },
        coffee: {
          parse: () => {
            throw new Error("CoffeeScript front matter is not supported");
          },
        },
      },
    });
    data = parsed.data;
    content = parsed.content;
  } catch (e) {
    return {
      success: false,
      error: {
        field: "frontmatter",
        message:
          e instanceof Error ? e.message : "Failed to parse frontmatter",
      },
    };
  }

  const nameWithoutExt = fileName.replace(/\.md$/i, "");

  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : nameWithoutExt;

  // Always pass through the canonical normalizer, regardless of source.
  // Frontmatter slugs were previously trusted verbatim, which let punctuation
  // (e.g., `?`) leak into stored slugs. See `.claude/rules/identifiers.md`.
  const hasFrontmatterSlug =
    typeof data.slug === "string" && data.slug.trim().length > 0;
  const slugSource = hasFrontmatterSlug
    ? (data.slug as string).trim()
    : nameWithoutExt;
  const slugSourceField: "frontmatter" | "filename" = hasFrontmatterSlug
    ? "frontmatter"
    : "filename";

  let slug: string;
  try {
    slug = generateSlug(slugSource);
  } catch (e) {
    // Only swallow the specific "cannot generate slug" failure from
    // `generateSlug`. Any other throw (e.g., a future length cap) should
    // propagate so it isn't silently flattened to a "bad slug" error.
    if (!(e instanceof Error) || !/cannot generate slug/i.test(e.message)) {
      throw e;
    }
    return {
      success: false,
      error: {
        field: "slug",
        message:
          slugSourceField === "frontmatter"
            ? `Frontmatter slug "${slugSource}" must contain at least one alphanumeric character.`
            : `Could not derive a valid slug from the filename "${nameWithoutExt}". Please add a \`slug:\` field to the frontmatter.`,
      },
    };
  }

  const category =
    typeof data.category === "string" && data.category.trim()
      ? data.category.trim()
      : DEFAULT_POST_CATEGORY;

  // Validate lengths
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      success: false,
      error: {
        field: "title",
        message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer`,
      },
    };
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return {
      success: false,
      error: {
        field: "slug",
        message: `Slug must be ${MAX_SLUG_LENGTH} characters or fewer`,
      },
    };
  }
  if (category.length > MAX_POST_CATEGORY_LENGTH) {
    return {
      success: false,
      error: {
        field: "category",
        message: `Category must be ${MAX_POST_CATEGORY_LENGTH} characters or fewer`,
      },
    };
  }

  return {
    success: true,
    data: { title, slug, category, body: content.trim() },
  };
}
