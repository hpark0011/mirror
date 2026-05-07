// Regression test for the disabled-while-saving invariant on the Cancel/back
// button in the article editor toolbar.
//
// The prop wiring is:
//   <WorkspaceBackButton disabled={isSaving} ... />
//
// If that prop is ever dropped or wired to the wrong state, this test fails
// before any E2E suite can catch it.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";

// WorkspaceToolbar portals children into a ToolbarSlotContext target element.
// In the unit harness there is no provider, so we mock it to render children
// inline — all we care about is that the props flow down to the buttons.
vi.mock("@/components/workspace-toolbar-slot", () => ({
  WorkspaceToolbar: ({ children }: { children: ReactNode }) => (
    <div data-testid="workspace-toolbar-mock">{children}</div>
  ),
}));

// next/link is not available in the vitest/happy-dom environment.
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

const { ArticleEditorToolbar } = await import(
  "@/features/articles/components/editor/article-editor-toolbar"
);

const baseProps = {
  status: "draft" as const,
  isSaving: false,
  hasPendingUploads: false,
  onSave: vi.fn(),
  onPublishToggle: vi.fn(async () => {}),
  onCancel: vi.fn(),
};

describe("ArticleEditorToolbar — back/cancel button disabled state", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("disables the workspace-back-button while isSaving=true", () => {
    render(<ArticleEditorToolbar {...baseProps} isSaving={true} />);
    const back = screen.getByTestId("workspace-back-button");
    expect(back).toBeTruthy();
    // The button element itself must be disabled — guards against navigation
    // racing a save in flight.
    expect((back as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables the workspace-back-button when isSaving=false", () => {
    render(<ArticleEditorToolbar {...baseProps} isSaving={false} />);
    const back = screen.getByTestId("workspace-back-button");
    expect(back).toBeTruthy();
    expect((back as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not render the back button when onCancel is omitted", () => {
    const { onCancel: _omit, ...withoutCancel } = baseProps;
    render(<ArticleEditorToolbar {...withoutCancel} />);
    expect(screen.queryByTestId("workspace-back-button")).toBeNull();
  });
});
