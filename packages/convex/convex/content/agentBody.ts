// Agent-friendly representation of post/article bodies.
//
// The Tiptap document JSON (`body: v.any()` on `posts` and `articles`) is
// rich, nested, and full of editor-internal attrs. Feeding raw Tiptap JSON
// into an LLM tool schema would invite hallucinated node shapes, image
// nodes with attacker-controlled `src` URLs, and broken `marks` chains.
//
// Instead, the configuration agent uses a small typed block schema:
//
//   - paragraph: { type, text }
//   - heading:   { type, level: 2 | 3, text }
//   - bulletList: { type, items: string[] }
//
// `agentBlocksToTiptapDoc` converts blocks → editor JSON for the
// `applyContentPatch` mutation; `tiptapDocToAgentBlocks` and
// `tiptapDocToPlainText` do the reverse for read tools so the LLM can
// reason about an existing body before replacing it. Bodies with richer
// nodes (images, embeds, tables, level-1/4+ headings, ordered lists, code
// blocks) are projected to blocks lossily — the prompt is responsible for
// surfacing this to the owner before replacement.
//
// Pure module: no Convex runtime imports. Safe to share with future
// editor-side adapters if needed.

import { type JSONContent } from "./bodyWalk";

export type AgentContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bulletList"; items: string[] };

export class AgentBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentBodyError";
  }
}

const MAX_BLOCKS_PER_BODY = 200;
const MAX_TEXT_LENGTH_PER_BLOCK = 4000;
const MAX_BULLET_ITEMS = 50;

function assertNonEmptyText(value: string, context: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AgentBodyError(`${context} text must not be empty`);
  }
  if (trimmed.length > MAX_TEXT_LENGTH_PER_BLOCK) {
    throw new AgentBodyError(
      `${context} text exceeds ${MAX_TEXT_LENGTH_PER_BLOCK} characters`,
    );
  }
  return trimmed;
}

/**
 * Convert agent-supplied blocks into a Tiptap document. The output shape
 * matches what the editor produces for the same content — paragraphs,
 * level-2/3 headings, and bullet lists with single-paragraph items.
 *
 * Empty `blocks` is intentionally allowed and produces a doc with a single
 * empty paragraph, mirroring Tiptap's empty-editor state. This keeps the
 * write path consistent with the editor's serialization of an empty body.
 */
export function agentBlocksToTiptapDoc(
  blocks: ReadonlyArray<AgentContentBlock>,
): JSONContent {
  if (blocks.length > MAX_BLOCKS_PER_BODY) {
    throw new AgentBodyError(
      `body exceeds ${MAX_BLOCKS_PER_BODY} blocks (got ${blocks.length})`,
    );
  }

  // Empty blocks ([]) are valid and represent the editor's empty state.
  // The policy: allow empty bodies on create. The Zod schema enforces
  // this at the LLM boundary (configurationTools.ts), and the Convex
  // validator (toolMutations.ts) allows it internally. The empty-paragraph
  // doc matches what the editor would persist for an empty post.
  if (blocks.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const content: JSONContent[] = blocks.map((block) => {
    if (block.type === "paragraph") {
      const text = assertNonEmptyText(block.text, "paragraph");
      return {
        type: "paragraph",
        content: [{ type: "text", text }],
      };
    }

    if (block.type === "heading") {
      if (block.level !== 2 && block.level !== 3) {
        throw new AgentBodyError(
          `heading level must be 2 or 3 (got ${String(block.level)})`,
        );
      }
      const text = assertNonEmptyText(block.text, "heading");
      return {
        type: "heading",
        attrs: { level: block.level },
        content: [{ type: "text", text }],
      };
    }

    if (block.type === "bulletList") {
      if (!Array.isArray(block.items) || block.items.length === 0) {
        throw new AgentBodyError("bulletList must include at least one item");
      }
      if (block.items.length > MAX_BULLET_ITEMS) {
        throw new AgentBodyError(
          `bulletList exceeds ${MAX_BULLET_ITEMS} items`,
        );
      }
      return {
        type: "bulletList",
        content: block.items.map((item) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: assertNonEmptyText(item, "bullet item") }],
            },
          ],
        })),
      };
    }

    throw new AgentBodyError(
      `unsupported block type: ${String((block as { type: string }).type)}`,
    );
  });

  return { type: "doc", content };
}

function collectTextFromNode(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map((child) => collectTextFromNode(child)).join("");
}

/**
 * Best-effort projection of an editor body into agent blocks. Used by the
 * read tool so the LLM can reason about existing content before replacement.
 *
 * Projection rules (intentionally lossy — see Constraints in the plan):
 *   - `paragraph` → paragraph (text concatenated, marks dropped).
 *   - `heading` with `attrs.level === 2 | 3` → heading at that level.
 *     Other levels are flattened to paragraphs to keep the agent schema
 *     stable.
 *   - `bulletList` → bulletList whose items are the concatenated text of
 *     each `listItem`'s descendants.
 *   - `orderedList`, `blockquote`, `codeBlock`, `image`, anything else →
 *     flattened to a paragraph carrying the leaf text. The text-only model
 *     means image attrs and code metadata are dropped silently; the prompt
 *     surfaces "this body has more shape than I can edit" via the read
 *     tool's `bodyText` output.
 */
export function tiptapDocToAgentBlocks(
  body: JSONContent | null | undefined,
): AgentContentBlock[] {
  if (!body || !Array.isArray(body.content)) return [];
  const out: AgentContentBlock[] = [];

  for (const node of body.content) {
    if (!node || typeof node !== "object") continue;
    const text = collectTextFromNode(node).trim();

    if (node.type === "heading") {
      const level = Number(node.attrs?.level);
      if (level === 2 || level === 3) {
        if (text) out.push({ type: "heading", level, text });
        continue;
      }
      // Other heading levels: flatten to paragraph so the agent's writeable
      // schema stays a clean subset.
      if (text) out.push({ type: "paragraph", text });
      continue;
    }

    if (node.type === "bulletList") {
      const items: string[] = [];
      const children = node.content ?? [];
      for (const item of children) {
        const itemText = collectTextFromNode(item).trim();
        if (itemText) items.push(itemText);
      }
      if (items.length > 0) out.push({ type: "bulletList", items });
      continue;
    }

    // paragraph + everything else collapses to a paragraph.
    if (text) out.push({ type: "paragraph", text });
  }

  return out;
}

/**
 * Plain text representation of an editor body, joined by blank lines
 * between blocks. Mirrors `extractPlainText` from `embeddings/textExtractor`
 * but trims trailing whitespace and bounds the output length so the read
 * tool's response stays compact for the LLM context window.
 */
export function tiptapDocToPlainText(
  body: JSONContent | null | undefined,
  maxChars = 8000,
): string {
  if (!body || !Array.isArray(body.content)) return "";
  const parts: string[] = [];

  for (const node of body.content) {
    if (!node || typeof node !== "object") continue;

    if (node.type === "bulletList") {
      const items = (node.content ?? [])
        .map((item) => collectTextFromNode(item).trim())
        .filter(Boolean);
      if (items.length > 0) parts.push(items.map((i) => `- ${i}`).join("\n"));
      continue;
    }

    const text = collectTextFromNode(node).trim();
    if (!text) continue;

    if (node.type === "heading") {
      const level = Number(node.attrs?.level);
      const prefix = level === 2 ? "## " : level === 3 ? "### " : "";
      parts.push(`${prefix}${text}`);
      continue;
    }

    parts.push(text);
  }

  const joined = parts.join("\n\n");
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}

/**
 * Boundary guard for any caller that constructs a Tiptap document by hand.
 * Rejects bodies containing image nodes or unknown block shapes.
 * The agent schema is text-only for v1, so any unsupported block type
 * is a sign the caller is writing a raw Tiptap document rather than
 * using the structured `agentBlocksToTiptapDoc` converter.
 *
 * Note: `agentBlocksToTiptapDoc` outputs are already constrained by the
 * converter's closed enum of supported block types (paragraph, heading, bulletList),
 * so this assertion is not applied after that converter. It exists as a guard
 * for future raw-body callers at storage boundaries.
 */
export function assertAgentSafeBody(body: JSONContent): void {
  if (!body || body.type !== "doc" || !Array.isArray(body.content)) {
    throw new AgentBodyError("body must be a Tiptap doc node");
  }

  for (const node of body.content) {
    if (!node || typeof node !== "object") {
      throw new AgentBodyError("body contains invalid node");
    }
    if (node.type === "paragraph" || node.type === "heading") {
      // ok — text-only descendants validated below
    } else if (node.type === "bulletList") {
      // ok — same
    } else {
      throw new AgentBodyError(
        `body contains unsupported node type: ${String(node.type)}`,
      );
    }
    if (containsImageNode(node)) {
      throw new AgentBodyError("body contains image nodes — not allowed");
    }
  }
}

function containsImageNode(node: JSONContent): boolean {
  if (node.type === "image") return true;
  if (!node.content) return false;
  return node.content.some((child) => containsImageNode(child));
}

const SUPPORTED_TOP_LEVEL_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
]);

export type AgentBodyProjectionAnalysis = {
  /** True when `tiptapDocToAgentBlocks` would drop structure or styling. */
  lossy: boolean;
  /** Unique node types (and `heading-level-N` markers) the projection cannot represent. */
  unsupportedNodeTypes: string[];
};

/**
 * Inspect a stored editor body and report whether the agent-block projection
 * is lossy. The read tool surfaces this so the LLM can warn the owner before
 * replacing a body that contains images, ordered lists, code blocks, links,
 * or any other shape the text-only block schema cannot round-trip.
 */
export function analyzeAgentBodyProjection(
  body: JSONContent | null | undefined,
): AgentBodyProjectionAnalysis {
  if (!body || !Array.isArray(body.content)) {
    return { lossy: false, unsupportedNodeTypes: [] };
  }

  const unsupported = new Set<string>();
  let droppedMarks = false;

  const visit = (
    node: JSONContent,
    depth: number,
    parentType: string | undefined,
  ): void => {
    if (!node || typeof node !== "object") return;

    if (node.type === "image") {
      unsupported.add("image");
    }

    if (
      node.type === "text" &&
      Array.isArray(node.marks) &&
      node.marks.length > 0
    ) {
      droppedMarks = true;
    }

    if (depth === 0) {
      if (!SUPPORTED_TOP_LEVEL_TYPES.has(node.type ?? "")) {
        unsupported.add(node.type ?? "unknown");
      } else if (node.type === "heading") {
        const level = Number(node.attrs?.level);
        if (level !== 2 && level !== 3) {
          unsupported.add(`heading-level-${level || "unknown"}`);
        }
      }
    }

    // Bullet list items collapse to a single string per item; nested lists,
    // multi-paragraph items, or non-paragraph children are dropped.
    if (parentType === "listItem") {
      const childCount = node.content?.length ?? 0;
      if (node.type !== "paragraph" || childCount > 1) {
        unsupported.add("bulletList-nested");
      }
    }

    if (node.content) {
      for (const child of node.content) {
        visit(child, depth + 1, node.type);
      }
    }
  };

  for (const node of body.content) {
    visit(node, 0, undefined);
  }

  if (droppedMarks) unsupported.add("text-marks");

  return {
    lossy: unsupported.size > 0,
    unsupportedNodeTypes: Array.from(unsupported).sort(),
  };
}
