"use client";

import type { Editor } from "@tiptap/react";
import { memo } from "react";
import { INLINE_FORMAT_ACTIONS } from "./format-actions";
import { ToolbarButton } from "./toolbar-button";

interface FormatGroupProps {
  editor: Editor;
}

export const FormatGroup = memo(function FormatGroup({
  editor,
}: FormatGroupProps) {
  return (
    <>
      {INLINE_FORMAT_ACTIONS.map((action) => (
        <ToolbarButton
          key={action.key}
          label={action.label}
          onClick={() => action.command(editor)}
          isActive={action.isActive(editor)}
          disabled={action.canRun ? !action.canRun(editor) : false}
          tabIndex={-1}
        >
          <action.icon className="size-4" />
        </ToolbarButton>
      ))}
    </>
  );
});
