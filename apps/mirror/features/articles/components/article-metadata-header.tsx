"use client";

// Inline metadata header that sits above the body editor in the article
// editor shell. Owns:
//   - controlled title input (large, h1 styling)
//   - slug input that auto-derives from title until the user manually edits
//     it; clearing it re-enables auto-derive
//   - category text input
//   - cover image picker (file input → presigned upload → preview)
//   - read-only created/published timestamps
//
// Publish/unpublish lives in the workspace toolbar (`ArticlePublishToggle`),
// not here.
import { Input } from "@feel-good/ui/primitives/input";
import { Label } from "@feel-good/ui/primitives/label";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import { useCallback, useId, useRef } from "react";
import { CoverImagePicker } from "./cover-image-picker";

export interface ArticleMetadataHeaderProps {
  title: string;
  slug: string;
  category: string;
  coverImageUrl: string | null;
  createdAt: number | null;
  publishedAt: number | null;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
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
  coverImageUrl,
  createdAt,
  publishedAt,
  onTitleChange,
  onSlugChange,
  onCategoryChange,
  onCoverImageUpload,
  onCoverImageClear,
}: ArticleMetadataHeaderProps) {
  const titleId = useId();
  const slugId = useId();
  const categoryId = useId();

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
    <div className="flex flex-col gap-7 py-8 pb-7">
      <Input
        id={titleId}
        data-testid="article-title-input"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Article Title"
        aria-label="Title"
        className="h-fit border-0 p-0 text-2xl font-medium shadow-none focus-visible:ring-0 md:text-2xl rounded-none hover:bg-transparent"
      />

      <div className="flex flex-col gap-2 pb-9 border-b border-border-subtle">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1 items-start">
            <span className="text-[13px] text-muted-foreground w-30 pt-1">
              Cover Image
            </span>
            <CoverImagePicker
              url={coverImageUrl}
              onUpload={onCoverImageUpload}
              onClear={onCoverImageClear}
            />
          </div>
          <div className="flex gap-1 items-center">
            <Label
              htmlFor={slugId}
              className="text-[13px] text-muted-foreground w-30"
            >
              Slug
            </Label>
            <Input
              id={slugId}
              data-testid="article-slug-input"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="auto-from-title"
              variant="underline"
              className="border-transparent"
              size="sm"
            />
          </div>
          <div className="flex gap-1 items-center">
            <Label
              htmlFor={categoryId}
              className="text-[13px] text-muted-foreground w-30"
            >
              Category
            </Label>
            <Input
              id={categoryId}
              data-testid="article-category-input"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              placeholder="e.g. Process, Inspiration"
              variant="underline"
              className="border-transparent"
              size="sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px] text-muted-foreground">
          <div className="flex flex-col gap-1">
            <div>Created</div>
            <div data-testid="article-created-at" className="text-foreground">
              {formatTimestamp(createdAt)}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div>Published</div>
            <div data-testid="article-published-at" className="text-foreground">
              {publishedAt ? formatTimestamp(publishedAt) : "Not yet"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
