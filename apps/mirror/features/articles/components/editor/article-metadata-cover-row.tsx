"use client";

import { CoverImagePicker } from "./cover-image-picker";

export interface ArticleMetadataCoverRowProps {
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  onUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onClear: () => void;
}

export function ArticleMetadataCoverRow({
  imageUrl,
  videoUrl,
  videoPosterUrl,
  onUpload,
  onClear,
}: ArticleMetadataCoverRowProps) {
  return (
    <div className="flex gap-1 items-start mb-1">
      <span className="text-[13px] text-muted-foreground w-30 pt-1 font-medium">
        Cover
      </span>
      <CoverImagePicker
        imageUrl={imageUrl}
        videoUrl={videoUrl}
        videoPosterUrl={videoPosterUrl}
        onUpload={onUpload}
        onClear={onClear}
      />
    </div>
  );
}
