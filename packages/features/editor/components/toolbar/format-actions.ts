// Data definitions for the inline / list / block format buttons. Both the
// bubble menu and the fixed toolbar consume these arrays so the two
// surfaces stay in sync.
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  ListBulletIcon,
  ListNumberIcon,
  QuoteOpeningIcon,
  StrikethroughIcon,
} from "@feel-good/icons";
import type { ComponentType } from "react";
import type { Editor } from "@tiptap/react";

export interface FormatAction {
  key: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  command: (editor: Editor) => void;
  isActive: (editor: Editor) => boolean;
  canRun?: (editor: Editor) => boolean;
}

export const INLINE_FORMAT_ACTIONS: FormatAction[] = [
  {
    key: "bold",
    icon: BoldIcon,
    label: "Bold",
    command: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive("bold"),
    canRun: (editor) => editor.can().chain().focus().toggleBold().run(),
  },
  {
    key: "italic",
    icon: ItalicIcon,
    label: "Italic",
    command: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive("italic"),
    canRun: (editor) => editor.can().chain().focus().toggleItalic().run(),
  },
  {
    key: "strikethrough",
    icon: StrikethroughIcon,
    label: "Strikethrough",
    command: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive("strike"),
    canRun: (editor) => editor.can().chain().focus().toggleStrike().run(),
  },
  {
    key: "code",
    icon: CodeIcon,
    label: "Code",
    command: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive("code"),
    canRun: (editor) => editor.can().chain().focus().toggleCode().run(),
  },
];

export const LIST_FORMAT_ACTIONS: FormatAction[] = [
  {
    key: "bulletList",
    icon: ListBulletIcon,
    label: "Bullet list",
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive("bulletList"),
  },
  {
    key: "orderedList",
    icon: ListNumberIcon,
    label: "Numbered list",
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive("orderedList"),
  },
];

export const BLOCK_FORMAT_ACTIONS: FormatAction[] = [
  {
    key: "codeBlock",
    icon: CodeIcon,
    label: "Code block",
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive("codeBlock"),
  },
  {
    key: "blockquote",
    icon: QuoteOpeningIcon,
    label: "Blockquote",
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive("blockquote"),
  },
];
