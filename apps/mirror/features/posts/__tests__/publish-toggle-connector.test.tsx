// FR-01: Returns null when useIsProfileOwner() is false
// FR-04: Calls api.posts.mutations.update with { id, status }
// FR-05: Does not call mutation when dialog is cancelled
// FR-07: Error toast fires and dialog remains open when mutation rejects
// FR-08: Double-submit guard — second rapid click is a no-op
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Track the most recently rendered PublishToggle props so we can invoke callbacks
let capturedProps: {
  dialogOpen: boolean;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
} | null = null;

// Mock PublishToggle to render minimal HTML and capture callbacks
vi.mock("@/features/posts/components/publish-toggle", () => ({
  PublishToggle: (props: {
    status: string;
    isPending: boolean;
    dialogOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    capturedProps = props;
    return (
      <div data-testid="publish-toggle" data-dialog-open={String(props.dialogOpen)}>
        <button data-testid="trigger-btn" onClick={() => props.onOpenChange(true)}>
          {props.status === "draft" ? "Publish" : "Unpublish"}
        </button>
        {props.dialogOpen && (
          <div role="alertdialog">
            <button
              data-testid="confirm-btn"
              disabled={props.isPending}
              onClick={props.onConfirm}
            >
              {props.isPending ? "Publishing…" : props.status === "draft" ? "Publish" : "Unpublish"}
            </button>
            <button data-testid="cancel-btn" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  },
}));

// convex/react — useMutation returns a controllable function
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: mockUseMutation,
}));

// Profile context — useIsProfileOwner is controllable
let mockIsOwner = true;

vi.mock("@/features/profile/context/profile-context", () => ({
  useIsProfileOwner: () => mockIsOwner,
}));

// Toast — spy on showToast
const mockShowToast = vi.fn();

vi.mock("@feel-good/ui/components/toast", () => ({
  showToast: mockShowToast,
}));

// ── Load component after mocks ─────────────────────────────────────────────

const { PublishToggleConnector } = await import(
  "@/features/posts/components/publish-toggle-connector"
);

// ── Fixtures ───────────────────────────────────────────────────────────────

const draftPost = {
  _id: "posts:draft123" as Id<"posts">,
  _creationTime: 0,
  userId: "users:user1" as Id<"users">,
  slug: "test-draft",
  title: "Test Draft",
  body: null,
  createdAt: 0,
  status: "draft" as const,
  category: "test",
};

const publishedPost = {
  ...draftPost,
  _id: "posts:published123" as Id<"posts">,
  slug: "test-published",
  status: "published" as const,
  publishedAt: 1000,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PublishToggleConnector", () => {
  afterEach(() => {
    cleanup();
    capturedProps = null;
  });

  beforeEach(() => {
    mockIsOwner = true;
    const defaultFn = vi.fn<[], Promise<null>>().mockResolvedValue(null);
    mockUseMutation.mockImplementation(() => defaultFn);
    mockShowToast.mockClear();
    capturedProps = null;
  });

  describe("FR-01: owner guard", () => {
    it("returns null when useIsProfileOwner() is false", () => {
      mockIsOwner = false;
      const { container } = render(<PublishToggleConnector post={draftPost} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders PublishToggle when useIsProfileOwner() is true", () => {
      mockIsOwner = true;
      render(<PublishToggleConnector post={draftPost} />);
      expect(screen.getByTestId("publish-toggle")).toBeDefined();
    });
  });

  describe("FR-04: mutation called with correct args", () => {
    it("calls update with { id, status: 'published' } when owner confirms publish on draft", async () => {
      const user = userEvent.setup();
      const mutationFn = vi.fn<[], Promise<null>>().mockResolvedValue(null);
      mockUseMutation.mockImplementation(() => mutationFn);

      render(<PublishToggleConnector post={draftPost} />);

      // Open dialog
      await user.click(screen.getByTestId("trigger-btn"));
      // Confirm
      await user.click(screen.getByTestId("confirm-btn"));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledTimes(1);
        expect(mutationFn).toHaveBeenCalledWith({
          id: draftPost._id,
          status: "published",
        });
      });
    });

    it("calls update with { id, status: 'draft' } when owner confirms unpublish on published post", async () => {
      const user = userEvent.setup();
      const mutationFn = vi.fn<[], Promise<null>>().mockResolvedValue(null);
      mockUseMutation.mockImplementation(() => mutationFn);

      render(<PublishToggleConnector post={publishedPost} />);

      await user.click(screen.getByTestId("trigger-btn"));
      await user.click(screen.getByTestId("confirm-btn"));

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledTimes(1);
        expect(mutationFn).toHaveBeenCalledWith({
          id: publishedPost._id,
          status: "draft",
        });
      });
    });

    it("shows success toast and closes dialog on successful mutation", async () => {
      const user = userEvent.setup();
      const mutationFn = vi.fn<[], Promise<null>>().mockResolvedValue(null);
      mockUseMutation.mockImplementation(() => mutationFn);

      render(<PublishToggleConnector post={draftPost} />);

      await user.click(screen.getByTestId("trigger-btn"));
      await user.click(screen.getByTestId("confirm-btn"));

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "success" }),
        );
        // Dialog is closed on success
        expect(capturedProps?.dialogOpen).toBe(false);
      });
    });
  });

  describe("FR-05: cancel does not call mutation", () => {
    it("does not call mutation when dialog is cancelled", async () => {
      const user = userEvent.setup();
      const mutationFn = vi.fn<[], Promise<null>>().mockResolvedValue(null);
      mockUseMutation.mockImplementation(() => mutationFn);

      render(<PublishToggleConnector post={draftPost} />);

      await user.click(screen.getByTestId("trigger-btn"));
      await user.click(screen.getByTestId("cancel-btn"));

      await waitFor(() => {
        expect(mutationFn).not.toHaveBeenCalled();
        // Dialog is closed on cancel
        expect(capturedProps?.dialogOpen).toBe(false);
      });
    });
  });

  describe("FR-07: error behavior", () => {
    it("fires error toast and keeps dialog open when mutation rejects", async () => {
      const user = userEvent.setup();
      const rejectedFn = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));
      mockUseMutation.mockImplementation(() => rejectedFn);

      render(<PublishToggleConnector post={draftPost} />);

      await user.click(screen.getByTestId("trigger-btn"));
      // Dialog is now open
      expect(screen.getByRole("alertdialog")).toBeDefined();

      await user.click(screen.getByTestId("confirm-btn"));

      // Wait for the rejected promise to settle
      await waitFor(
        () => {
          expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error" }),
          );
        },
        { timeout: 3000 },
      );

      // Dialog must stay open for retry (not closed in catch/finally)
      expect(capturedProps?.dialogOpen).toBe(true);
    });
  });

  describe("FR-08: double-submit guard", () => {
    it("disables confirm button while mutation is in-flight and second rapid click is a no-op", async () => {
      const user = userEvent.setup();
      let resolveMutation!: (value: null) => void;
      const hangingFn = vi.fn(
        () =>
          new Promise<null>((resolve) => {
            resolveMutation = resolve;
          }),
      );
      mockUseMutation.mockImplementation(() => hangingFn);

      render(<PublishToggleConnector post={draftPost} />);

      await user.click(screen.getByTestId("trigger-btn"));

      // First click starts the in-flight mutation
      await user.click(screen.getByTestId("confirm-btn"));

      // While in-flight, confirm button must be disabled (isPending=true)
      await waitFor(() => {
        expect(capturedProps?.isPending).toBe(true);
        const confirmBtn = screen.getByTestId("confirm-btn") as HTMLButtonElement;
        expect(confirmBtn.disabled).toBe(true);
      });

      // Second click while in-flight is a no-op (isSubmittingRef guard)
      await user.click(screen.getByTestId("confirm-btn"));

      // Resolve the mutation
      await act(async () => {
        resolveMutation(null);
      });

      // Only one mutation call despite two clicks
      await waitFor(() => {
        expect(hangingFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
