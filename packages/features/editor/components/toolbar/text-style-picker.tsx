"use client";

import {
  TextFormatIcon,
  TextFormatSizeLargerIcon,
  TriangleFillDownIcon,
} from "@feel-good/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@feel-good/ui/primitives/tooltip";
import type { Editor } from "@tiptap/react";

type TextStyle = "paragraph" | "heading-1" | "heading-2" | "heading-3";

const TEXT_STYLE_LABELS: Record<TextStyle, string> = {
  paragraph: "Paragraph",
  "heading-1": "Heading 1",
  "heading-2": "Heading 2",
  "heading-3": "Heading 3",
};

function getActiveTextStyle(editor: Editor): TextStyle {
  if (editor.isActive("heading", { level: 1 })) return "heading-1";
  if (editor.isActive("heading", { level: 2 })) return "heading-2";
  if (editor.isActive("heading", { level: 3 })) return "heading-3";
  return "paragraph";
}

function applyTextStyle(editor: Editor, style: string) {
  switch (style) {
    case "heading-1":
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      break;
    case "heading-2":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "heading-3":
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    case "paragraph":
      editor.chain().focus().setParagraph().run();
      break;
  }
}

interface TextStylePickerProps {
  editor: Editor;
}

export function TextStylePicker({ editor }: TextStylePickerProps) {
  const active = getActiveTextStyle(editor);
  return (
    <DropdownMenu>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild className="outline-none">
            <button
              className="tiptap-toolbar-dropdown-trigger"
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
            >
              {TEXT_STYLE_LABELS[active]}
              <TriangleFillDownIcon className="size-[7px]" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className="px-1.5 py-1 rounded-sm">
          Text style
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(value) => applyTextStyle(editor, value)}
        >
          <DropdownMenuRadioItem value="paragraph">
            <TextFormatIcon className="size-4" />
            Paragraph
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="heading-1">
            <TextFormatSizeLargerIcon className="size-4" />
            Heading 1
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="heading-2">
            <TextFormatSizeLargerIcon className="size-4" />
            Heading 2
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="heading-3">
            <TextFormatSizeLargerIcon className="size-4" />
            Heading 3
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
