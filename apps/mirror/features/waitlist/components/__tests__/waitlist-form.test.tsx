/**
 * FR-08: Rate-limit copy renders when `useMutation` rejects with a
 * `ConvexError({ code: "RATE_LIMIT", retryAfterMs })`.
 * FR-08: Generic error copy renders when the rejection is an unrelated Error.
 * FR-09: Invalid client-side email triggers zero `useMutation` invocations and
 * shows the Zod validation message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";

const submitMock = vi.fn();

// Mock `convex/react` so the component can import `useMutation` without
// spinning up a real ConvexProvider. Each test resets `submitMock` so we
// can script specific resolutions/rejections per scenario.
vi.mock("convex/react", () => ({
  useMutation: () => submitMock,
}));

// Import after the mock so the component picks up the mocked `useMutation`.
const { WaitlistForm } = await import("@/features/waitlist/components/waitlist-form");

describe("WaitlistForm", () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders rate-limit copy when the mutation rejects with ConvexError RATE_LIMIT", async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValueOnce(
      new ConvexError({ code: "RATE_LIMIT", retryAfterMs: 60_000 }),
    );

    render(<WaitlistForm />);

    const input = screen.getByTestId("home.waitlist.email-input");
    await user.type(input, "real@user.test");
    await user.click(screen.getByTestId("home.waitlist.submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("home.waitlist.form-error")).toBeDefined();
    });

    expect(screen.getByTestId("home.waitlist.form-error").textContent).toBe(
      "You've submitted a few times — please try again in a little while.",
    );
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("renders generic error copy when the mutation rejects with a plain Error", async () => {
    const user = userEvent.setup();
    submitMock.mockRejectedValueOnce(new Error("network"));

    render(<WaitlistForm />);

    const input = screen.getByTestId("home.waitlist.email-input");
    await user.type(input, "real@user.test");
    await user.click(screen.getByTestId("home.waitlist.submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("home.waitlist.form-error")).toBeDefined();
    });

    expect(screen.getByTestId("home.waitlist.form-error").textContent).toBe(
      "Something went wrong, please try again.",
    );
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("does not call the mutation and shows the Zod message when the email is invalid", async () => {
    const user = userEvent.setup();
    render(<WaitlistForm />);

    const input = screen.getByTestId("home.waitlist.email-input");
    await user.type(input, "not-an-email");
    await user.click(screen.getByTestId("home.waitlist.submit-btn"));

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address."),
      ).toBeDefined();
    });

    expect(submitMock).not.toHaveBeenCalled();
  });
});
