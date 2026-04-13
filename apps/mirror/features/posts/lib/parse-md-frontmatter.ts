import matter from "gray-matter";
import {
  MAX_TITLE_LENGTH,
  MAX_SLUG_LENGTH,
} from "@feel-good/convex/convex/content/schema";
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

  const slug =
    typeof data.slug === "string" && data.slug.trim()
      ? data.slug.trim()
      : nameWithoutExt
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");

  const category =
    typeof data.category === "string" && data.category.trim()
      ? data.category.trim()
      : DEFAULT_POST_CATEGORY;

  // Validate non-empty slug
  if (!slug) {
    return {
      success: false,
      error: {
        field: "slug",
        message:
          "Could not derive a valid slug from the filename. Please add a slug field to the frontmatter.",
      },
    };
  }

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
