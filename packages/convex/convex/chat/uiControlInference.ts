import type { UiControlAction } from "./uiControlTypes";

export function getTestUiControlResponse(message: string): {
  actions: UiControlAction[];
  confirmation: string;
} | null {
  const normalized = message.toLowerCase();
  if (!normalized.startsWith("[ui-control-test]")) return null;

  if (normalized.includes("articles") && normalized.includes("music")) {
    return {
      actions: [
        {
          type: "setListControls",
          kind: "articles",
          searchQuery: "music",
        },
      ],
      confirmation: "Showing articles about music.",
    };
  }

  if (normalized.includes("posts") && normalized.includes("oldest")) {
    return {
      actions: [
        {
          type: "setListControls",
          kind: "posts",
          sortOrder: "oldest",
        },
      ],
      confirmation: "Showing posts sorted oldest first.",
    };
  }

  if (normalized.includes("clear")) {
    return {
      actions: [
        { type: "clearListControls", kind: "posts" },
        { type: "clearListControls", kind: "articles" },
      ],
      confirmation: "Cleared the list controls.",
    };
  }

  return {
    actions: [{ type: "navigate", kind: "posts" }],
    confirmation: "Showing posts.",
  };
}

export function inferUiControlResponse(message: string): {
  actions: UiControlAction[];
  confirmation: string;
} | null {
  const normalized = message.toLowerCase().trim();
  const asksForUi =
    /\b(show|open|go to|view|filter|search|sort|clear)\b/.test(normalized) &&
    /\b(post|posts|article|articles|filter|filters|search|sort)\b/.test(
      normalized,
    );
  if (!asksForUi) return null;

  if (/\bclear\b/.test(normalized) && /\b(filter|filters|search)\b/.test(normalized)) {
    return {
      actions: [
        { type: "clearListControls", kind: "posts" },
        { type: "clearListControls", kind: "articles" },
      ],
      confirmation: "Cleared the list controls.",
    };
  }

  const kind: "posts" | "articles" =
    /\barticle|articles\b/.test(normalized) ? "articles" : "posts";
  const sortOrder = /\boldest\b/.test(normalized)
    ? "oldest"
    : /\bnewest\b/.test(normalized)
      ? "newest"
      : undefined;
  const aboutMatch = normalized.match(/\babout\s+(.+)$/);
  const searchQuery = aboutMatch?.[1]
    ?.replace(/[.!?]$/u, "")
    .trim();

  if (sortOrder || searchQuery) {
    return {
      actions: [
        {
          type: "setListControls",
          kind,
          ...(sortOrder ? { sortOrder } : {}),
          ...(searchQuery ? { searchQuery } : {}),
        },
      ],
      confirmation: [
        `Showing ${kind}`,
        searchQuery ? `about ${searchQuery}` : null,
        sortOrder === "oldest" ? "sorted oldest first" : null,
        sortOrder === "newest" ? "sorted newest first" : null,
      ].filter(Boolean).join(" ") + ".",
    };
  }

  return {
    actions: [{ type: "navigate", kind }],
    confirmation: `Showing ${kind}.`,
  };
}
