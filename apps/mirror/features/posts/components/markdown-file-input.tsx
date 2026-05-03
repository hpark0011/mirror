"use client";

import { type ChangeEvent } from "react";

type MarkdownFileInputProps = {
  isParsing: boolean;
  onFileSelect: (file: File) => void;
};

/**
 * The `<input type="file">` and "Parsing file..." status row of the
 * markdown-upload dialog. Extracted from `markdown-upload-dialog.tsx`
 * (FG_116) to keep the dialog under the ~100-line component guideline.
 */
export function MarkdownFileInput({
  isParsing,
  onFileSelect,
}: MarkdownFileInputProps) {
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }

  return (
    <>
      <div>
        <input
          type="file"
          accept=".md"
          onChange={handleFileChange}
          className="block w-full text-sm text-foreground-muted file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
        />
      </div>
      {isParsing && (
        <p className="text-sm text-foreground-muted">Parsing file...</p>
      )}
    </>
  );
}
