"use client";

import { useRef, useState } from "react";
import {
  type FieldPath,
  type FieldPathValue,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import {
  ALLOWED_INLINE_IMAGE_TYPES,
  ALLOWED_INLINE_IMAGE_TYPES_ATTR,
  MAX_INLINE_IMAGE_BYTES,
} from "@/lib/media-policy";
import { type ProjectFormValues } from "../../lib/schemas/project.schema";
import { useProjectCoverImageUpload } from "../../hooks/use-project-cover-image-upload";

type ProjectCoverFieldProps = {
  watch: UseFormWatch<ProjectFormValues>;
  setValue: UseFormSetValue<ProjectFormValues>;
};

function validateCoverFile(file: File): string | null {
  if (!ALLOWED_INLINE_IMAGE_TYPES.has(file.type)) {
    return "Cover image must be PNG, JPEG, or WebP.";
  }
  if (file.size > MAX_INLINE_IMAGE_BYTES) {
    return "Cover image must be 5 MB or smaller.";
  }
  return null;
}

export function ProjectCoverField({ watch, setValue }: ProjectCoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlRef = useRef<string | null>(null);
  const { upload } = useProjectCoverImageUpload();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageUrl = watch("coverImageUrl");
  const hasCover = Boolean(imageUrl);

  const setProjectField = <TName extends FieldPath<ProjectFormValues>>(
    name: TName,
    value: FieldPathValue<ProjectFormValues, TName>,
  ) =>
    setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });

  const revokeLocalPreview = () => {
    if (!localPreviewUrlRef.current) return;
    URL.revokeObjectURL(localPreviewUrlRef.current);
    localPreviewUrlRef.current = null;
  };

  const handleFile = async (file: File) => {
    const validationError = validateCoverFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    revokeLocalPreview();
    localPreviewUrlRef.current = previewUrl;
    setProjectField("coverImageUrl", previewUrl);
    setError(null);
    setUploading(true);

    try {
      const result = await upload(file);
      setProjectField("coverImageStorageId", result.storageId);
      setProjectField("coverImageThumbhash", result.thumbhash);
      setProjectField("clearCover", false);
    } catch (err) {
      console.error("[project-cover-field] upload failed", err);
      revokeLocalPreview();
      setProjectField("coverImageUrl", null);
      setProjectField("coverImageStorageId", null);
      setProjectField("coverImageThumbhash", "");
      setError("Cover upload failed. Try another image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="flex items-start gap-1.5"
      data-project-cover-uploading={uploading ? "true" : "false"}
    >
      <span className="text-[13px] text-muted-foreground w-40 pt-1 font-medium">
        Cover
      </span>
      <div className="flex flex-col gap-2 w-full">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_INLINE_IMAGE_TYPES_ATTR}
          className="sr-only"
          disabled={uploading}
          data-testid="project-cover-image-input"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await handleFile(file);
            event.target.value = "";
          }}
        />

        {hasCover ? (
          <div className="relative w-full overflow-hidden rounded-lg border border-border-subtle bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl!}
              alt="Project cover"
              className="block aspect-[16/9] w-full object-cover"
            />
            <div className="absolute right-2 top-2 flex gap-1">
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Replace"}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                onClick={() => {
                  revokeLocalPreview();
                  setProjectField("coverImageUrl", null);
                  setProjectField("coverImageStorageId", null);
                  setProjectField("coverImageThumbhash", "");
                  setProjectField("clearCover", true);
                }}
                disabled={uploading}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-fit"
            data-testid="project-cover-add-button"
          >
            <Icon name="PhotoFillIcon" className="size-4" />
            {uploading ? "Uploading..." : "Add cover"}
          </Button>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
