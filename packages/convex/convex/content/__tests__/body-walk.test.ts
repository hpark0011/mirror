import { describe, expect, it } from "vitest";

import {
  type JSONContent,
  extractInlineImageStorageIds,
  mapInlineImages,
} from "../body-walk";

describe("extractInlineImageStorageIds", () => {
  it("returns empty array for null body", () => {
    expect(extractInlineImageStorageIds(null)).toEqual([]);
  });

  it("returns empty array for undefined body", () => {
    expect(extractInlineImageStorageIds(undefined)).toEqual([]);
  });

  it("returns empty array for empty doc", () => {
    const body: JSONContent = { type: "doc", content: [] };
    expect(extractInlineImageStorageIds(body)).toEqual([]);
  });

  it("returns storageIds from nested image nodes (paragraph, heading, blockquote)", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { storageId: "id-1", src: "u1" } },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            { type: "image", attrs: { storageId: "id-2", src: "u2" } },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "image", attrs: { storageId: "id-3", src: "u3" } },
              ],
            },
          ],
        },
      ],
    };
    expect(extractInlineImageStorageIds(body)).toEqual(["id-1", "id-2", "id-3"]);
  });

  it("returns duplicates as duplicates (multiset semantics)", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { storageId: "dup", src: "a" } },
            { type: "image", attrs: { storageId: "dup", src: "b" } },
            { type: "image", attrs: { storageId: "uniq", src: "c" } },
          ],
        },
      ],
    };
    expect(extractInlineImageStorageIds(body)).toEqual(["dup", "dup", "uniq"]);
  });

  it("skips image nodes lacking storageId", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { src: "external" } },
            { type: "image", attrs: { storageId: "kept", src: "u" } },
            { type: "image" },
          ],
        },
      ],
    };
    expect(extractInlineImageStorageIds(body)).toEqual(["kept"]);
  });

  it("skips image nodes with non-string or empty storageId", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        { type: "image", attrs: { storageId: "" } },
        { type: "image", attrs: { storageId: 42 as unknown as string } },
        { type: "image", attrs: { storageId: "ok" } },
      ],
    };
    expect(extractInlineImageStorageIds(body)).toEqual(["ok"]);
  });

  it("preserves document order across siblings and descendants", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        { type: "image", attrs: { storageId: "first" } },
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { storageId: "second" } },
            { type: "image", attrs: { storageId: "third" } },
          ],
        },
        { type: "image", attrs: { storageId: "fourth" } },
      ],
    };
    expect(extractInlineImageStorageIds(body)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
  });
});

describe("mapInlineImages", () => {
  it("rewrites every image node's attrs", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "image", attrs: { src: "external-1" } },
            { type: "text", text: "between" },
            { type: "image", attrs: { src: "external-2" } },
          ],
        },
      ],
    };
    const mapped = mapInlineImages(body, (attrs) => ({
      ...(attrs ?? {}),
      storageId: `id-${(attrs?.src as string).split("-")[1]}`,
      src: `https://convex/${(attrs?.src as string).split("-")[1]}`,
    })) as JSONContent;
    const ids = extractInlineImageStorageIds(mapped);
    expect(ids).toEqual(["id-1", "id-2"]);
    // Direct attr assertion: catches a bug where storageId is set but src
    // is dropped (the extract-and-compare-ids path wouldn't notice).
    expect(mapped.content?.[0].content?.[0].attrs).toEqual({
      src: "https://convex/1",
      storageId: "id-1",
    });
    expect(mapped.content?.[0].content?.[2].attrs).toEqual({
      src: "https://convex/2",
      storageId: "id-2",
    });
  });

  it("preserves tree shape for non-image nodes", () => {
    const body: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hello" },
            { type: "image", attrs: { src: "u" } },
          ],
        },
      ],
    };
    const mapped = mapInlineImages(body, (attrs) => ({
      ...(attrs ?? {}),
      storageId: "added",
    })) as JSONContent;

    expect(mapped.type).toBe("doc");
    expect(mapped.content?.[0].type).toBe("paragraph");
    expect(mapped.content?.[0].content?.[0]).toEqual({
      type: "text",
      text: "hello",
    });
    expect(mapped.content?.[0].content?.[1].attrs).toEqual({
      src: "u",
      storageId: "added",
    });
  });

  it("returns null/undefined for null/undefined input", () => {
    expect(mapInlineImages(null, (a) => a)).toBeNull();
    expect(mapInlineImages(undefined, (a) => a)).toBeUndefined();
  });

  it("does not mutate the input tree", () => {
    const inner = { type: "image", attrs: { src: "u" } };
    const body: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [inner] }],
    };
    const before = JSON.stringify(body);
    mapInlineImages(body, (attrs) => ({
      ...(attrs ?? {}),
      storageId: "mutated?",
    }));
    expect(JSON.stringify(body)).toBe(before);
    expect(inner.attrs).toEqual({ src: "u" });
  });
});
