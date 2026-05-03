import Image from "@tiptap/extension-image";

/**
 * Custom Tiptap Image extension that adds a `storageId` attribute to track
 * Convex `_storage` blob ownership across the body's lifecycle (FR-01).
 *
 * The attribute round-trips through HTML as `data-storage-id` so a body
 * persisted as HTML and re-parsed preserves the storage reference.
 *
 * The base configuration mirrors the stock `Image.configure(...)` shape from
 * `extensions.ts:12-17` — `inline: false`, `loading: "lazy"` — so swapping
 * this extension in is behavior-preserving for the article viewer.
 *
 * Return type intentionally inferred (FG_116) — `Node` from `@tiptap/core`
 * widens away the `Image.extend(...)` storage/options shape.
 */
export function createInlineImageExtension() {
  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        storageId: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-storage-id"),
          renderHTML: (attrs) => {
            if (!attrs.storageId) return {};
            return { "data-storage-id": attrs.storageId };
          },
        },
      };
    },
  }).configure({
    inline: false,
    HTMLAttributes: {
      loading: "lazy",
    },
  });
}
