/**
 * Article serializer for Tavus conversational context.
 * Converts Tiptap JSONContent (article body) to Markdown-like plain text
 * suitable for the Tavus video generation API's `conversational_context` parameter.
 */

/**
 * Minimal JSONContent type representation.
 * Inline definition to avoid dependency on @tiptap/core.
 */
type JSONContent = {
  type?: string;
  text?: string;
  content?: JSONContent[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

/**
 * Article structure with title and body content.
 */
type Article = {
  title: string;
  body: JSONContent;
};

/**
 * Maximum length for serialized context (characters).
 * Truncate output to respect Tavus API limits.
 */
const MAX_CONTEXT_LENGTH = 8000;

/**
 * Applies text-level formatting marks to content.
 * Converts Tiptap marks (bold, italic, etc.) to Markdown syntax.
 */
function applyMarks(text: string, marks?: Array<{ type: string }>): string {
  if (!marks || marks.length === 0) return text;

  let formatted = text;
  for (const mark of marks) {
    if (mark.type === "bold") {
      formatted = `**${formatted}**`;
    } else if (mark.type === "italic") {
      formatted = `_${formatted}_`;
    }
    // Additional mark types can be added here
  }
  return formatted;
}

/**
 * Recursively serializes a JSONContent node to Markdown-like output.
 * Handles headings, paragraphs, lists, code blocks, and text formatting.
 */
function serializeNode(node: JSONContent): string {
  const { type, text, content, attrs, marks } = node;

  // Text node: apply marks for bold, italic, etc.
  if (type === "text") {
    return text ? applyMarks(text, marks) : "";
  }

  // Heading: # ## ### based on level (default 2)
  if (type === "heading") {
    const level = (attrs?.level as number) || 2;
    const headingText = content
      ?.map((child) => serializeNode(child))
      .join("")
      .trim() || "";
    return `${"#".repeat(level)} ${headingText}\n\n`;
  }

  // Paragraph: simple line with newlines
  if (type === "paragraph") {
    const paragraphText = content
      ?.map((child) => serializeNode(child))
      .join("")
      .trim() || "";
    return `${paragraphText}\n\n`;
  }

  // Blockquote: prefix with >
  if (type === "blockquote") {
    const blockquoteText = content
      ?.map((child) => serializeNode(child))
      .join("")
      .trim() || "";
    return `> ${blockquoteText}\n\n`;
  }

  // Code block: wrapped in backticks
  if (type === "codeBlock") {
    const codeText = content
      ?.map((child) => serializeNode(child))
      .join("")
      .trim() || "";
    return `\`\`\`\n${codeText}\n\`\`\`\n\n`;
  }

  // Unordered list: recurse and collect listItems
  if (type === "bulletList") {
    return (
      content
        ?.map((child) => {
          if (child.type === "listItem") {
            const itemText = child.content
              ?.map((c) => serializeNode(c))
              .join("")
              .trim() || "";
            return `- ${itemText}\n`;
          }
          return serializeNode(child);
        })
        .join("")
        .trim() + "\n\n"
    );
  }

  // Ordered list: number the items
  if (type === "orderedList") {
    let itemIndex = 1;
    return (
      content
        ?.map((child) => {
          if (child.type === "listItem") {
            const itemText = child.content
              ?.map((c) => serializeNode(c))
              .join("")
              .trim() || "";
            return `${itemIndex++}. ${itemText}\n`;
          }
          return serializeNode(child);
        })
        .join("")
        .trim() + "\n\n"
    );
  }

  // Horizontal rule
  if (type === "horizontalRule") {
    return "---\n\n";
  }

  // Default: recurse into children and join
  if (content && content.length > 0) {
    return content.map((child) => serializeNode(child)).join("");
  }

  // Fallback: return empty string for unknown types
  return "";
}

/**
 * Serializes an array of articles into Markdown-like plain text
 * suitable for Tavus conversational context.
 *
 * Each article is formatted with a heading title followed by body content,
 * separated by horizontal rules. Output is truncated at MAX_CONTEXT_LENGTH.
 *
 * @param articles - Array of articles with title and body content
 * @returns Serialized Markdown-like string, truncated to MAX_CONTEXT_LENGTH
 */
export function serializeArticlesToContext(articles: Article[]): string {
  const serialized = articles
    .map((article) => {
      const titleSection = `# ${article.title}\n\n`;
      const bodySection = serializeNode(article.body);
      return `${titleSection}${bodySection}---\n\n`;
    })
    .join("")
    .trim();

  // Truncate at MAX_CONTEXT_LENGTH if necessary
  if (serialized.length > MAX_CONTEXT_LENGTH) {
    return serialized.substring(0, MAX_CONTEXT_LENGTH).trim() + "...";
  }

  return serialized;
}

/**
 * Export types for consumers
 */
export type { JSONContent, Article };

/**
 * Export constant for consumers who need to respect the limit
 */
export { MAX_CONTEXT_LENGTH };
