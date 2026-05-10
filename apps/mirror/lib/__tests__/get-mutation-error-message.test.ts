import { describe, expect, it } from "vitest";
import {
  GENERIC_FALLBACK,
  getMutationErrorMessage,
} from "../get-mutation-error-message";

describe("getMutationErrorMessage", () => {
  it("passes through user-facing ConvexError messages", () => {
    const message =
      "Bio entry limit reached (50). Delete an entry to add another.";

    expect(getMutationErrorMessage(new Error(message))).toBe(message);
  });

  it.each(["Not authenticated", "Unauthenticated", "App user not found"])(
    "replaces internal-only auth message %s with the generic fallback",
    (message) => {
      expect(getMutationErrorMessage(new Error(message))).toBe(
        GENERIC_FALLBACK,
      );
    },
  );

  it("uses the generic fallback for non-Error thrown values", () => {
    expect(getMutationErrorMessage("oops")).toBe(GENERIC_FALLBACK);
  });
});
