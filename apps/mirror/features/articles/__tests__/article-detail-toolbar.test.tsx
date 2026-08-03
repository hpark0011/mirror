// FR-01: Edit button is hidden when useIsProfileOwner() is false
// FR-02: Edit button renders for owner with canonical href
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/features/content", () => ({
  ContentToolbarShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="toolbar-shell">{children}</div>
  ),
  WorkspaceBackButton: ({ href }: { href: string }) => (
    <a data-testid="workspace-back-button" href={href}>
      Back
    </a>
  ),
  getContentHref: (username: string, kind: string) => `/@${username}/${kind}`,
}));

let mockIsOwner = true;
vi.mock("@/features/profile", () => ({
  useIsProfileOwner: () => mockIsOwner,
}));

const { ArticleDetailToolbar } =
  await import("@/features/articles/components/detail/article-detail-toolbar");

describe("ArticleDetailToolbar", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockIsOwner = true;
  });

  describe("FR-01: owner-only Edit button", () => {
    it("hides the Edit button when useIsProfileOwner() is false", () => {
      mockIsOwner = false;
      render(<ArticleDetailToolbar username="alice" slug="hello-world" />);
      expect(screen.queryByTestId("edit-article-btn")).toBeNull();
    });

    it("renders the Edit button when useIsProfileOwner() is true", () => {
      mockIsOwner = true;
      render(<ArticleDetailToolbar username="alice" slug="hello-world" />);
      expect(screen.getByTestId("edit-article-btn")).toBeDefined();
    });
  });

  describe("FR-02: Edit href is canonical", () => {
    it("links to /@username/articles/:slug/edit", () => {
      mockIsOwner = true;
      render(<ArticleDetailToolbar username="alice" slug="hello-world" />);

      const editLink = screen.getByTestId("edit-article-btn");
      expect(editLink.getAttribute("href")).toBe(
        "/@alice/articles/hello-world/edit",
      );
    });
  });
});
