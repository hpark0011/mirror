"use client";

// Inline metadata header above the body editor: title (RHF), cover image
// (managed outside RHF — the picker returns storageId/thumbhash/url which
// the hook stores directly), slug + category (RHF, see
// ArticleMetadataTextFields), and read-only timestamps. Slug auto-derive
// lives in `useAutoSlug`. Publish/unpublish is in the toolbar
// (`ArticlePublishToggle`), not here.
import { Input } from "@feel-good/ui/primitives/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { type UseFormReturn } from "react-hook-form";
import { useAutoSlug } from "../../hooks/use-auto-slug";
import { ArticleMetadataCoverRow } from "./article-metadata-cover-row";
import { ArticleMetadataTextFields } from "./article-metadata-text-fields";
import { ArticleMetadataTimestamps } from "./article-metadata-timestamps";
import { type CoverUploadState } from "../../hooks/use-article-cover-video-upload";
import { type ArticleMetadataFormData } from "../../lib/schemas/article-metadata.schema";

export interface ArticleMetadataHeaderProps {
  form: UseFormReturn<ArticleMetadataFormData>;
  coverImageUrl: string | null;
  coverVideoUrl: string | null;
  coverVideoPosterUrl: string | null;
  coverUploadState: CoverUploadState;
  createdAt: number | null;
  publishedAt: number | null;
  onCoverUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onCoverClear: () => void;
}

export function ArticleMetadataHeader({
  form,
  coverImageUrl,
  coverVideoUrl,
  coverVideoPosterUrl,
  coverUploadState,
  createdAt,
  publishedAt,
  onCoverUpload,
  onCoverClear,
}: ArticleMetadataHeaderProps) {
  const { handleTitleChange, handleSlugChange } = useAutoSlug(form);

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
            <ArticleMetadataCoverRow
              imageUrl={coverImageUrl}
              videoUrl={coverVideoUrl}
              videoPosterUrl={coverVideoPosterUrl}
              coverUploadState={coverUploadState}
              onUpload={onCoverUpload}
              onClear={onCoverClear}
            />
            <ArticleMetadataTextFields
              form={form}
              onSlugChange={handleSlugChange}
            />
          </div>

          <ArticleMetadataTimestamps
            createdAt={createdAt}
            publishedAt={publishedAt}
          />
        </div>
      </div>
    </Form>
  );
}
