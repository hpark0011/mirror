"use client";

import { type ParsedMarkdownFile } from "../hooks/use-markdown-file-parser";

type ParsedMetadataPreviewProps = {
  parsed: ParsedMarkdownFile;
};

export function ParsedMetadataPreview({ parsed }: ParsedMetadataPreviewProps) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div>
        <span className="text-xs font-medium text-foreground-muted">Title</span>
        <p className="text-sm" data-testid="preview-title">
          {parsed.metadata.title}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium text-foreground-muted">Slug</span>
        <p
          className="text-sm text-foreground-muted"
          data-testid="preview-slug"
        >
          {parsed.metadata.slug}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium text-foreground-muted">
          Category
        </span>
        <p className="text-sm" data-testid="preview-category">
          {parsed.metadata.category}
        </p>
      </div>
    </div>
  );
}
