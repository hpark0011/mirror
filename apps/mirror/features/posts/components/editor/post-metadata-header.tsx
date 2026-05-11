"use client";

// Inline metadata header above the body editor: title (RHF), cover image
// or video (managed outside RHF — the picker returns
// storageId/thumbhash/url which the form hook stores directly), slug +
// category (RHF, see PostMetadataTextFields), and read-only timestamps.
// Slug auto-derive lives in `useAutoSlug`. Publish/unpublish is in the
// toolbar (`PostPublishToggle`), not here.
//
// Mirrors `apps/mirror/features/articles/components/editor/article-metadata-header.tsx`.
import { Input } from "@feel-good/ui/primitives/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAutoSlug } from "../../hooks/use-auto-slug";
import { PostMetadataCoverRow } from "./post-metadata-cover-row";
import { PostMetadataTextFields } from "./post-metadata-text-fields";
import { PostMetadataTimestamps } from "./post-metadata-timestamps";
import { type CoverUploadState } from "../../hooks/use-post-cover-video-upload";
import { type PostMetadataFormData } from "../../lib/schemas/post-metadata.schema";

export interface PostMetadataHeaderProps {
  form: UseFormReturn<PostMetadataFormData>;
  coverImageUrl: string | null;
  coverVideoUrl: string | null;
  coverVideoPosterUrl: string | null;
  coverUploadState: CoverUploadState;
  createdAt: number | null;
  publishedAt: number | null;
  onCoverUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onCoverClear: () => void;
}

export function PostMetadataHeader({
  form,
  coverImageUrl,
  coverVideoUrl,
  coverVideoPosterUrl,
  coverUploadState,
  createdAt,
  publishedAt,
  onCoverUpload,
  onCoverClear,
}: PostMetadataHeaderProps) {
  const { t } = useTranslation();
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
                  data-testid="post-title-input"
                  placeholder={t("postEditor.titlePlaceholder")}
                  aria-label={t("editor.titleAriaLabel")}
                  className="h-fit border-0 p-0 text-2xl font-medium shadow-none focus-visible:ring-0 md:text-2xl rounded-none hover:bg-transparent"
                  onChange={(e) =>
                    handleTitleChange(e.target.value, field.onChange)
                  }
                />
              </FormControl>
              <FormMessage data-testid="post-title-error" />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 pb-9 border-b border-border-subtle">
          <div className="flex flex-col gap-1">
            <PostMetadataCoverRow
              imageUrl={coverImageUrl}
              videoUrl={coverVideoUrl}
              videoPosterUrl={coverVideoPosterUrl}
              coverUploadState={coverUploadState}
              onUpload={onCoverUpload}
              onClear={onCoverClear}
            />
            <PostMetadataTextFields
              form={form}
              onSlugChange={handleSlugChange}
            />
          </div>

          <PostMetadataTimestamps
            createdAt={createdAt}
            publishedAt={publishedAt}
          />
        </div>
      </div>
    </Form>
  );
}
