import { describe, expect, it } from "vitest";
import {
  agentBlocksToTiptapDoc,
  AgentBodyError,
  analyzeAgentBodyProjection,
  assertAgentSafeBody,
  tiptapDocToAgentBlocks,
  tiptapDocToPlainText,
  type AgentContentBlock,
} from "../agentBody";

describe("agentBlocksToTiptapDoc", () => {
  it("returns an empty paragraph for empty blocks", () => {
    const doc = agentBlocksToTiptapDoc([]);
    expect(doc).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("converts paragraphs to Tiptap paragraph nodes", () => {
    const doc = agentBlocksToTiptapDoc([
      { type: "paragraph", text: "Hello world" },
    ]);
    expect(doc.content?.[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Hello world" }],
    });
  });

  it("converts level-2 and level-3 headings", () => {
    const doc = agentBlocksToTiptapDoc([
      { type: "heading", level: 2, text: "Main" },
      { type: "heading", level: 3, text: "Sub" },
    ]);
    expect(doc.content).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Main" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Sub" }],
      },
    ]);
  });

  it("rejects heading levels other than 2 or 3", () => {
    const bad: AgentContentBlock = {
      type: "heading",
      // @ts-expect-error invalid level for runtime assertion
      level: 1,
      text: "Top",
    };
    expect(() => agentBlocksToTiptapDoc([bad])).toThrow(AgentBodyError);
  });

  it("converts bulletList with items into listItem→paragraph nodes", () => {
    const doc = agentBlocksToTiptapDoc([
      { type: "bulletList", items: ["one", "two"] },
    ]);
    expect(doc.content?.[0]).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "one" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "two" }],
            },
          ],
        },
      ],
    });
  });

  it("rejects empty paragraph text", () => {
    expect(() =>
      agentBlocksToTiptapDoc([{ type: "paragraph", text: "   " }]),
    ).toThrow(AgentBodyError);
  });

  it("rejects empty bullet lists", () => {
    expect(() =>
      agentBlocksToTiptapDoc([{ type: "bulletList", items: [] }]),
    ).toThrow(AgentBodyError);
  });

  it("rejects unknown block types", () => {
    expect(() =>
      // @ts-expect-error runtime check on unknown block
      agentBlocksToTiptapDoc([{ type: "image", url: "x" }]),
    ).toThrow(AgentBodyError);
  });

  it("rejects more than MAX_BLOCKS_PER_BODY paragraph blocks", () => {
    // The cap protects the DB write path from unbounded agent input. The
    // exact threshold is hard-coded here so a future tightening surfaces
    // as a test failure to revisit, not as a silent regression.
    const blocks: AgentContentBlock[] = Array.from({ length: 201 }, (_, i) => ({
      type: "paragraph",
      text: `paragraph ${i}`,
    }));
    expect(() => agentBlocksToTiptapDoc(blocks)).toThrow(AgentBodyError);
  });

  it("rejects paragraph text exceeding MAX_TEXT_LENGTH_PER_BLOCK", () => {
    expect(() =>
      agentBlocksToTiptapDoc([{ type: "paragraph", text: "x".repeat(4001) }]),
    ).toThrow(AgentBodyError);
  });

  it("rejects bulletList items exceeding MAX_BULLET_ITEMS", () => {
    const items = Array.from({ length: 51 }, (_, i) => `item ${i}`);
    expect(() =>
      agentBlocksToTiptapDoc([{ type: "bulletList", items }]),
    ).toThrow(AgentBodyError);
  });
});

describe("tiptapDocToAgentBlocks", () => {
  it("returns [] for null bodies", () => {
    expect(tiptapDocToAgentBlocks(null)).toEqual([]);
    expect(tiptapDocToAgentBlocks(undefined)).toEqual([]);
  });

  it("round-trips agent-authored documents", () => {
    const blocks: AgentContentBlock[] = [
      { type: "heading", level: 2, text: "Hello" },
      { type: "paragraph", text: "world" },
      { type: "bulletList", items: ["a", "b"] },
    ];
    const doc = agentBlocksToTiptapDoc(blocks);
    expect(tiptapDocToAgentBlocks(doc)).toEqual(blocks);
  });

  it("flattens unsupported levels into paragraphs", () => {
    const blocks = tiptapDocToAgentBlocks({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Top" }],
        },
      ],
    });
    expect(blocks).toEqual([{ type: "paragraph", text: "Top" }]);
  });

  it("flattens blockquote and codeBlock leaves to paragraphs", () => {
    const blocks = tiptapDocToAgentBlocks({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "quoted" }],
            },
          ],
        },
        {
          type: "codeBlock",
          content: [{ type: "text", text: "code" }],
        },
      ],
    });
    expect(blocks).toEqual([
      { type: "paragraph", text: "quoted" },
      { type: "paragraph", text: "code" },
    ]);
  });

  it("drops empty paragraphs and bullets", () => {
    const blocks = tiptapDocToAgentBlocks({
      type: "doc",
      content: [
        { type: "paragraph" },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
        },
      ],
    });
    expect(blocks).toEqual([]);
  });
});

describe("tiptapDocToPlainText", () => {
  it("joins block text with blank lines and prefixes headings", () => {
    const text = tiptapDocToPlainText({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Hello" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body text" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "one" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "two" }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(text).toBe("## Hello\n\nBody text\n\n- one\n- two");
  });

  it("returns empty string for empty doc", () => {
    expect(tiptapDocToPlainText({ type: "doc", content: [] })).toBe("");
    expect(tiptapDocToPlainText(null)).toBe("");
  });
});

describe("assertAgentSafeBody", () => {
  it("accepts a body built from agentBlocksToTiptapDoc", () => {
    const doc = agentBlocksToTiptapDoc([
      { type: "paragraph", text: "ok" },
      { type: "heading", level: 2, text: "h" },
      { type: "bulletList", items: ["x"] },
    ]);
    expect(() => assertAgentSafeBody(doc)).not.toThrow();
  });

  it("rejects bodies that include image nodes", () => {
    expect(() =>
      assertAgentSafeBody({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "https://example.com/x.png" },
              },
            ],
          },
        ],
      }),
    ).toThrow(AgentBodyError);
  });

  it("rejects bodies with unsupported top-level node types", () => {
    expect(() =>
      assertAgentSafeBody({
        type: "doc",
        content: [{ type: "codeBlock", content: [] }],
      }),
    ).toThrow(AgentBodyError);
  });
});

describe("analyzeAgentBodyProjection", () => {
  it("reports lossy=false for a body the projection can round-trip", () => {
    const result = analyzeAgentBodyProjection({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "H2" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "a" }] },
              ],
            },
          ],
        },
      ],
    });
    expect(result).toEqual({ lossy: false, unsupportedNodeTypes: [] });
  });

  it("flags text marks as a lossy projection", () => {
    const result = analyzeAgentBodyProjection({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "linked",
              marks: [{ type: "link", attrs: { href: "https://x" } }],
            },
          ],
        },
      ],
    });
    expect(result.lossy).toBe(true);
    expect(result.unsupportedNodeTypes).toContain("text-marks");
  });

  it("lists image, codeBlock, and orderedList as unsupported top-level types", () => {
    const result = analyzeAgentBodyProjection({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "ok" }] },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "one" }],
                },
              ],
            },
          ],
        },
        { type: "codeBlock", content: [{ type: "text", text: "x" }] },
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "https://x" } }],
        },
      ],
    });
    expect(result.lossy).toBe(true);
    expect(result.unsupportedNodeTypes).toEqual(
      expect.arrayContaining(["codeBlock", "image", "orderedList"]),
    );
  });

  it("flags heading levels outside 2-3 as unsupported", () => {
    const result = analyzeAgentBodyProjection({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Big" }],
        },
      ],
    });
    expect(result.lossy).toBe(true);
    expect(result.unsupportedNodeTypes).toContain("heading-level-1");
  });

  it("returns lossy=false for null/empty bodies", () => {
    expect(analyzeAgentBodyProjection(null)).toEqual({
      lossy: false,
      unsupportedNodeTypes: [],
    });
    expect(analyzeAgentBodyProjection({ type: "doc", content: [] })).toEqual({
      lossy: false,
      unsupportedNodeTypes: [],
    });
  });
});
