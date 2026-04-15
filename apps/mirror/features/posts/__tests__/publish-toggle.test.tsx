// FR-02: "Publish" label for draft, "Unpublish" label for published
// FR-03: Opens alertdialog with expected title when button is clicked
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

// Stub next/link to avoid full Next.js context
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

// Import after mocks
const { PublishToggle } = await import(
  "@/features/posts/components/publish-toggle"
);

describe("PublishToggle", () => {
  const noop = () => {};

  afterEach(() => {
    cleanup();
  });

  describe("FR-02: button label reflects status", () => {
    it('renders "Publish" when status is draft', () => {
      render(
        <PublishToggle
          status="draft"
          isPending={false}
          dialogOpen={false}
          onOpenChange={noop}
          onConfirm={noop}
          onCancel={noop}
        />,
      );
      const trigger = document.querySelector("[data-slot='alert-dialog-trigger']");
      expect(trigger).not.toBeNull();
      expect(trigger?.textContent).toBe("Publish");
    });

    it('renders "Unpublish" when status is published', () => {
      render(
        <PublishToggle
          status="published"
          isPending={false}
          dialogOpen={false}
          onOpenChange={noop}
          onConfirm={noop}
          onCancel={noop}
        />,
      );
      const trigger = document.querySelector("[data-slot='alert-dialog-trigger']");
      expect(trigger).not.toBeNull();
      expect(trigger?.textContent).toBe("Unpublish");
    });
  });

  describe("FR-03: dialog title matches transition target", () => {
    it('shows "Publish this post?" dialog title for a draft', () => {
      render(
        <PublishToggle
          status="draft"
          isPending={false}
          dialogOpen={true}
          onOpenChange={noop}
          onConfirm={noop}
          onCancel={noop}
        />,
      );
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toBeDefined();
      expect(dialog.textContent).toContain("Publish this post?");
    });

    it('shows "Move this post back to drafts?" dialog title for published', () => {
      render(
        <PublishToggle
          status="published"
          isPending={false}
          dialogOpen={true}
          onOpenChange={noop}
          onConfirm={noop}
          onCancel={noop}
        />,
      );
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toBeDefined();
      expect(dialog.textContent).toContain("Move this post back to drafts?");
    });

    it("calls onOpenChange when trigger button is clicked", () => {
      const onOpenChange = vi.fn();
      render(
        <PublishToggle
          status="draft"
          isPending={false}
          dialogOpen={false}
          onOpenChange={onOpenChange}
          onConfirm={noop}
          onCancel={noop}
        />,
      );
      // When dialog is closed, only the trigger button is present
      const trigger = document.querySelector(
        "[data-slot='alert-dialog-trigger']",
      ) as HTMLButtonElement;
      expect(trigger).not.toBeNull();
      fireEvent.click(trigger);
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });
});
