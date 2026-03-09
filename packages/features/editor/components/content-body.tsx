import type { JSONContent } from "@tiptap/core";

type ContentBodyProps = {
  content: JSONContent;
  className?: string;
};

/**
 * Lightweight renderer that maps TipTap JSONContent nodes to React elements.
 * Renders paragraphs, text (with marks), and images — no editor instance needed.
 */
export function ContentBody({ content, className }: ContentBodyProps) {
  if (!content.content) return null;

  return (
    <div className={className}>
      {content.content.map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </div>
  );
}

function Node({ node }: { node: JSONContent }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          {node.content?.map((child, i) => <Inline key={i} node={child} />)}
        </p>
      );

    case "image":
      return (
        <img
          src={node.attrs?.src}
          alt={node.attrs?.alt ?? ""}
          className="max-w-full"
        />
      );

    case "heading":
    case "blockquote":
    case "bulletList":
    case "orderedList":
    case "listItem":
    case "codeBlock":
      // Render block-level nodes as simple paragraphs
      return (
        <p>
          {node.content?.map((child, i) => <Node key={i} node={child} />)}
        </p>
      );

    default:
      // Text nodes at block level or unknown types
      if (node.text) return <Inline node={node} />;
      return null;
  }
}

function Inline({ node }: { node: JSONContent }) {
  if (!node.text) return null;

  let element: React.ReactNode = node.text;

  if (node.marks) {
    for (const mark of node.marks) {
      switch (mark.type) {
        case "bold":
          element = <strong>{element}</strong>;
          break;
        case "italic":
          element = <em>{element}</em>;
          break;
        case "link":
          element = (
            <a
              href={mark.attrs?.href}
              target={mark.attrs?.target ?? "_blank"}
              rel="noopener noreferrer"
            >
              {element}
            </a>
          );
          break;
        case "code":
          element = <code>{element}</code>;
          break;
        case "strike":
          element = <s>{element}</s>;
          break;
      }
    }
  }

  return <>{element}</>;
}
