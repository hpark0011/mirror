"use client";

// Inline metadata header that sits above the body editor in the article
// editor shell. Owns:
//   - controlled title input (large, h1 styling) — RHF FormField
//   - slug input that auto-derives from title until the user manually edits
//     it; clearing it re-enables auto-derive — RHF FormField
//   - category text input — RHF FormField
//   - cover image picker (file input → presigned upload → preview), which
//     lives outside RHF state because the picker emits multi-field results
//     (storageId/thumbhash/url) that are kept on the hook directly
//   - read-only created/published timestamps
//
// Validation errors render as `<FormMessage />` per `.claude/rules/forms.md`,
// driven by `articleMetadataSchema` via `zodResolver` in the parent hook.
// Publish/unpublish lives in the workspace toolbar (`ArticlePublishToggle`),
// not here.
import { Input } from "@feel-good/ui/primitives/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { generateSlug } from "@feel-good/convex/convex/content/slug";
import { useCallback, useRef } from "react";
import { type UseFormReturn } from "react-hook-form";
import { CoverImagePicker } from "./cover-image-picker";
import { type ArticleMetadataFormData } from "../../lib/schemas/article-metadata.schema";

export interface ArticleMetadataHeaderProps {
  form: UseFormReturn<ArticleMetadataFormData>;
  coverImageUrl: string | null;
  createdAt: number | null;
  publishedAt: number | null;
  onCoverImageUpload: (file: File) => Promise<{
    storageId: string;
    thumbhash: string;
    url: string;
  }>;
  onCoverImageClear: () => void;
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString();
}

function TimestampField({
  label,
  value,
  testId,
}: {
  label: string;
  value: number | null;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div>{label}</div>
      <div data-testid={testId} className="text-foreground">
        {value !== null ? formatTimestamp(value) : "—"}
      </div>
    </div>
  );
}

export function ArticleMetadataHeader({
  form,
  coverImageUrl,
  createdAt,
  publishedAt,
  onCoverImageUpload,
  onCoverImageClear,
}: ArticleMetadataHeaderProps) {
  // Track whether the slug has been manually edited so subsequent title
  // changes don't overwrite the user's choice. Reset to "auto-derive" when
  // the slug input is cleared. Initialised from the current slug value so
  // editing the title of an existing article does not silently rename its URL.
  const slugDirtyRef = useRef(
    (form.getValues("slug") ?? "").trim().length > 0,
  );

  const handleTitleChange = useCallback(
    (next: string, fieldOnChange: (value: string) => void) => {
      fieldOnChange(next);
      if (!slugDirtyRef.current) {
        if (next.trim().length === 0) {
          form.setValue("slug", "", { shouldValidate: false });
        } else {
          try {
            form.setValue("slug", generateSlug(next), {
              shouldValidate: false,
            });
          } catch {
            // generateSlug throws when the input has no usable chars
            // (pure punctuation). Leave slug untouched in that case.
          }
        }
      }
    },
    [form],
  );

  const handleSlugChange = useCallback(
    (next: string, fieldOnChange: (value: string) => void) => {
      slugDirtyRef.current = next.length > 0;
      fieldOnChange(next);
    },
    [],
  );

  return (
    <Form {...form}>
      <div className="flex flex-col gap-7 py-8 pb-7">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem className="gap-1">
              <FormControl>
                <Input
                  {...field}
                  data-testid="article-title-input"
                  placeholder="Article Title"
                  aria-label="Title"
                  className="h-fit border-0 p-0 text-2xl font-medium shadow-none focus-visible:ring-0 md:text-2xl rounded-none hover:bg-transparent"
                  onChange={(e) =>
                    handleTitleChange(e.target.value, field.onChange)
                  }
                />
              </FormControl>
              <FormMessage data-testid="article-title-error" />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 pb-9 border-b border-border-subtle">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1 items-start mb-1">
              <span className="text-[13px] text-muted-foreground w-30 pt-1 font-medium">
                Cover Image
              </span>
              <CoverImagePicker
                url={coverImageUrl}
                onUpload={onCoverImageUpload}
                onClear={onCoverImageClear}
              />
            </div>

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <div className="flex gap-1 items-center">
                    <FormLabel className="text-[13px] text-muted-foreground w-30">
                      Slug
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        data-testid="article-slug-input"
                        placeholder="auto-from-title"
                        variant="underline"
                        className="border-transparent"
                        size="sm"
                        onChange={(e) =>
                          handleSlugChange(e.target.value, field.onChange)
                        }
                      />
                    </FormControl>
                  </div>
                  <FormMessage data-testid="article-slug-error" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="gap-1">
                  <div className="flex gap-1 items-center">
                    <FormLabel className="text-[13px] text-muted-foreground w-30">
                      Category
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="article-category-input"
                        placeholder="e.g. Process, Inspiration"
                        variant="underline"
                        className="border-transparent"
                        size="sm"
                      />
                    </FormControl>
                  </div>
                  <FormMessage data-testid="article-category-error" />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-[13px] text-muted-foreground">
            <TimestampField
              label="Created"
              value={createdAt}
              testId="article-created-at"
            />
            <TimestampField
              label="Published"
              value={publishedAt}
              testId="article-published-at"
            />
          </div>
        </div>
      </div>
    </Form>
  );
}
