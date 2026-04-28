import { describe, expect, it } from "vitest";
import {
  getTestUiControlResponse,
  inferUiControlResponse,
} from "../uiControlInference";

describe("chat UI control prompt inference", () => {
  it("maps deterministic article search prompts to typed list actions", () => {
    const result = getTestUiControlResponse(
      "[ui-control-test] show articles about music",
    );

    expect(result).toEqual({
      actions: [
        {
          type: "setListControls",
          kind: "articles",
          searchQuery: "music",
        },
      ],
      confirmation: "Showing articles about music.",
    });
  });

  it("maps deterministic post sort prompts to typed list actions", () => {
    const result = getTestUiControlResponse(
      "[ui-control-test] go back to posts and sort oldest",
    );

    expect(result).toEqual({
      actions: [
        {
          type: "setListControls",
          kind: "posts",
          sortOrder: "oldest",
        },
      ],
      confirmation: "Showing posts sorted oldest first.",
    });
  });

  it("maps deterministic clear prompts to read-only clear actions", () => {
    const result = getTestUiControlResponse("[ui-control-test] clear filters");

    expect(result).toEqual({
      actions: [
        { type: "clearListControls", kind: "posts" },
        { type: "clearListControls", kind: "articles" },
      ],
      confirmation: "Cleared the list controls.",
    });
  });

  it("ignores non-UI chat prompts", () => {
    expect(inferUiControlResponse("What do you think about silence?")).toBeNull();
  });

  it("keeps inferred natural prompts read-only", () => {
    const result = inferUiControlResponse("show articles about creativity");

    expect(result?.actions).toEqual([
      {
        type: "setListControls",
        kind: "articles",
        searchQuery: "creativity",
      },
    ]);
  });
});
