"use client";

// Inline metadata header that sits above the body editor in the article
// editor shell. Owns:
//   - controlled title input (large, h1 styling)
//   - slug input that auto-derives from title until the user manually edits
//     it; clearing it re-enables auto-derive
//   - category text input
//   - status select (Draft / Published) — toggling to Published reveals
//     a populated `publishedAt` after the next save (server-set, FR-08)
//   - cover image picker (file input → presigned upload → preview)
//   - read-only created/published timestamps
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import { useCallback, useId, useRef } from "react";
import type { ArticleStatus } from "../lib/schemas/article-metadata.schema";
import { CoverImagePicker } from "./cover-image-picker";

export interface ArticleMetadataHeaderProps {
  title: string;
  slug: string;
  category: string;
  status: ArticleStatus;
  coverImageUrl: string | null;
  createdAt: number | null;
  publishedAt: number | null;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: ArticleStatus) => void;
  onCoverImageUpload: (file: File) => Promise<{
    storageId: string;
    url: string;
  }>;
  onCoverImageClear: () => void;
}

function formatTimestamp(value: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function ArticleMetadataHeader({
  title,
  slug,
  category,
  status,
  coverImageUrl,
  createdAt,
  publishedAt,
  onTitleChange,
  onSlugChange,
  onCategoryChange,
  onStatusChange,
  onCoverImageUpload,
  onCoverImageClear,
}: ArticleMetadataHeaderProps) {
  const titleId = useId();
  const slugId = useId();
  const categoryId = useId();
  const statusId = useId();

  // Track whether the slug has been manually edited so subsequent title
  // changes don't overwrite the user's choice. Reset to "auto-derive" when
  // the slug input is cleared.
  const slugDirtyRef = useRef(false);

  const handleTitleChange = useCallback(
    (next: string) => {
      onTitleChange(next);
      if (!slugDirtyRef.current) {
        if (next.trim().length === 0) {
          onSlugChange("");
        } else {
          try {
            onSlugChange(generateSlug(next));
          } catch {
            // generateSlug throws when the input has no usable chars
            // (pure punctuation). Leave slug untouched in that case.
          }
        }
      }
    },
    [onSlugChange, onTitleChange],
  );

  const handleSlugChange = useCallback(
    (next: string) => {
      slugDirtyRef.current = next.length > 0;
      onSlugChange(next);
    },
    [onSlugChange],
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <CoverImagePicker
        url={coverImageUrl}
        onUpload={onCoverImageUpload}
        onClear={onCoverImageClear}
      />

      <Input
        id={titleId}
        data-testid="article-title-input"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Untitled article"
        aria-label="Title"
        className="h-12 border-0 px-0 text-3xl font-medium shadow-none focus-visible:ring-0"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={slugId} className="text-xs text-muted-foreground">
            Slug
          </Label>
          <Input
            id={slugId}
            data-testid="article-slug-input"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="auto-from-title"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={categoryId}
            className="text-xs text-muted-foreground"
          >
            Category
          </Label>
          <Input
            id={categoryId}
            data-testid="article-category-input"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder="e.g. Process, Inspiration"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={statusId}
            className="text-xs text-muted-foreground"
          >
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(value: ArticleStatus) => onStatusChange(value)}
          >
            <SelectTrigger
              id={statusId}
              data-testid="article-status-select"
              className="h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div>
          <div>Created</div>
          <div data-testid="article-created-at" className="text-foreground">
            {formatTimestamp(createdAt)}
          </div>
        </div>
        <div>
          <div>Published</div>
          <div data-testid="article-published-at" className="text-foreground">
            {publishedAt ? formatTimestamp(publishedAt) : "Not yet"}
          </div>
        </div>
      </div>
    </div>
  );
}
