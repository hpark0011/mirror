import { describe, it, expect } from "vitest";
import {
  validateFile,
  parseMdFrontmatter,
} from "../parse-md-frontmatter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name: string, sizeBytes: number): File {
  // Pad content to reach the desired byte count
  const content = "a".repeat(sizeBytes);
  return new File([content], name);
}

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------

describe("validateFile", () => {
  it("returns null for a valid .md file under 500 KB", () => {
    const file = makeFile("post.md", 1024);
    expect(validateFile(file)).toBeNull();
  });

  it("returns an error message for a .txt file", () => {
    const file = makeFile("post.txt", 100);
    const result = validateFile(file);
    expect(result).not.toBeNull();
    expect(result).toContain(".md");
  });

  it("returns null for a .MD file (case-insensitive)", () => {
    const file = makeFile("POST.MD", 100);
    expect(validateFile(file)).toBeNull();
  });

  it("returns an error for a file over 500 KB", () => {
    const file = makeFile("large.md", 512_001);
    const result = validateFile(file);
    expect(result).not.toBeNull();
    expect(result).toContain("500 KB");
  });

  it("returns null for a file at exactly 512_000 bytes (boundary)", () => {
    const file = makeFile("boundary.md", 512_000);
    expect(validateFile(file)).toBeNull();
  });

  it("returns an error for a file at 512_001 bytes (one over boundary)", () => {
    const file = makeFile("boundary.md", 512_001);
    expect(validateFile(file)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseMdFrontmatter
// ---------------------------------------------------------------------------

describe("parseMdFrontmatter", () => {
  it("extracts title, slug, and category from valid frontmatter", () => {
    const content = `---
title: My Post
slug: my-post
category: Technology
---

Body content here.`;
    const result = parseMdFrontmatter(content, "my-post.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("My Post");
    expect(result.data.slug).toBe("my-post");
    expect(result.data.category).toBe("Technology");
  });

  it("falls back to filename for title and slug when frontmatter is missing", () => {
    const result = parseMdFrontmatter("Just body text.", "hello-world.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("hello-world");
    expect(result.data.slug).toBe("hello-world");
  });

  it("falls back to default category when category is absent from frontmatter", () => {
    const content = `---
title: A Post
slug: a-post
---
Body.`;
    const result = parseMdFrontmatter(content, "a-post.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    // DEFAULT_POST_CATEGORY is "Creativity"
    expect(result.data.category).toBe("Creativity");
  });

  it("derives slug from filename by stripping special chars — 'My Post!.md' → 'my-post'", () => {
    const result = parseMdFrontmatter("Body.", "My Post!.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe("my-post");
  });

  it("returns an error when filename yields an empty slug (unicode-only name)", () => {
    // After lowercasing + removing non-[a-z0-9-] characters the slug becomes empty
    const result = parseMdFrontmatter("Body.", "日本語.md");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.field).toBe("slug");
  });

  it("returns an error when title exceeds MAX_TITLE_LENGTH (500)", () => {
    const longTitle = "A".repeat(501);
    const content = `---\ntitle: "${longTitle}"\nslug: valid-slug\n---\nBody.`;
    const result = parseMdFrontmatter(content, "file.md");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.field).toBe("title");
  });

  it("returns an error when slug exceeds MAX_SLUG_LENGTH (200)", () => {
    const longSlug = "a".repeat(201);
    const content = `---\nslug: ${longSlug}\n---\nBody.`;
    const result = parseMdFrontmatter(content, "file.md");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.field).toBe("slug");
  });

  it("returns an error when category exceeds MAX_POST_CATEGORY_LENGTH (100)", () => {
    const longCategory = "C".repeat(101);
    const content = `---\ntitle: Title\nslug: valid-slug\ncategory: ${longCategory}\n---\nBody.`;
    const result = parseMdFrontmatter(content, "file.md");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.field).toBe("category");
  });

  it("returns success with empty body for empty file content", () => {
    const result = parseMdFrontmatter("", "empty-file.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.body).toBe("");
  });

  it("returns a frontmatter error for ---js delimiter (blocked engine)", () => {
    const content = `---js\n{ title: 'injected' }\n---\nBody.`;
    const result = parseMdFrontmatter(content, "file.md");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.field).toBe("frontmatter");
  });

  it("returns a frontmatter error for ---coffee delimiter (blocked engine)", () => {
    const content = `---coffee\ntitle: 'injected'\n---\nBody.`;
    const result = parseMdFrontmatter(content, "file.md");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.field).toBe("frontmatter");
  });

  it("trims leading/trailing whitespace from body content", () => {
    const content = `---\ntitle: Title\nslug: title-slug\n---\n\n  Body with spaces.  \n`;
    const result = parseMdFrontmatter(content, "file.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.body).toBe("Body with spaces.");
  });

  it("handles partial frontmatter (only title): slug falls back to filename, category to default", () => {
    const content = `---\ntitle: Only Title\n---\nBody.`;
    const result = parseMdFrontmatter(content, "my-filename.md");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Only Title");
    expect(result.data.slug).toBe("my-filename");
    expect(result.data.category).toBe("Creativity");
  });
});
