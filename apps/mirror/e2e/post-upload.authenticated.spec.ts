import { test, expect } from "./fixtures/auth";
import path from "path";
import fs from "fs";

const username = "test-user"; // matches ensureTestUser's username

function createTempMdFile(
  name: string,
  content: string,
): { path: string; cleanup: () => void } {
  const tmpDir = path.join(__dirname, ".tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, name);
  fs.writeFileSync(filePath, content);
  return {
    path: filePath,
    cleanup: () => {
      fs.unlinkSync(filePath);
      if (fs.readdirSync(tmpDir).length === 0) fs.rmdirSync(tmpDir);
    },
  };
}

const validMd = `---
title: Test Post Title
slug: test-post-title
category: Process
---

# Hello World

This is a test post with **bold** and *italic* text.
`;

const mdWithoutFrontmatter = `# No Frontmatter Post

Just markdown content without any YAML frontmatter.
`;

test.describe("Post markdown upload (authenticated)", () => {
  test("New button is visible for post owner", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("new-post-btn")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("new-post-btn")).toBeVisible();
  });

  test("upload dialog opens and accepts .md file with preview", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("new-post-btn")).toBeVisible({
      timeout: 10_000,
    });

    const newBtn = page.getByTestId("new-post-btn");
    await newBtn.click();

    // Dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByText("Import Markdown")).toBeVisible();

    // File input should accept .md files
    const fileInput = dialog.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute("accept", ".md");

    // Create button should be disabled initially
    const createBtn = dialog.getByTestId("create-post-btn");
    await expect(createBtn).toBeDisabled();

    // Upload a valid .md file
    const tmp = createTempMdFile("test-post.md", validMd);
    try {
      await fileInput.setInputFiles(tmp.path);

      // Preview should show extracted metadata
      await expect(dialog.getByTestId("preview-title")).toHaveText(
        "Test Post Title",
        { timeout: 5000 },
      );
      await expect(dialog.getByTestId("preview-slug")).toHaveText(
        "test-post-title",
      );
      await expect(dialog.getByTestId("preview-category")).toHaveText(
        "Process",
      );

      // Create button should be enabled after parsing
      await expect(createBtn).toBeEnabled();
    } finally {
      tmp.cleanup();
    }
  });

  test("fallbacks applied when frontmatter absent", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("new-post-btn")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("new-post-btn").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const tmp = createTempMdFile("My Cool Post.md", mdWithoutFrontmatter);
    try {
      await dialog.locator('input[type="file"]').setInputFiles(tmp.path);

      await expect(dialog.getByTestId("preview-title")).toHaveText(
        "My Cool Post",
        { timeout: 5000 },
      );
      await expect(dialog.getByTestId("preview-slug")).toHaveText(
        "my-cool-post",
      );
      await expect(dialog.getByTestId("preview-category")).toHaveText(
        "Creativity",
      );
    } finally {
      tmp.cleanup();
    }
  });

  test("error shown for non-.md file", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("new-post-btn")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("new-post-btn").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    const tmp = createTempMdFile("not-markdown.txt", "just plain text");
    try {
      await dialog.locator('input[type="file"]').setInputFiles(tmp.path);

      const error = dialog.getByRole("alert");
      await expect(error).toBeVisible({ timeout: 3000 });
      await expect(error).toContainText(".md");
    } finally {
      tmp.cleanup();
    }
  });

  test("dialog closes when Cancel clicked", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/@${username}/posts`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("new-post-btn")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("new-post-btn").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
