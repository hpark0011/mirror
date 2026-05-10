"use client";

import { CoverImagePicker } from "./cover-image-picker";
import { type CoverUploadState } from "../../hooks/use-article-cover-video-upload";

export interface ArticleMetadataCoverRowProps {
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  coverUploadState: CoverUploadState;
  onUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onClear: () => void;
}

export function ArticleMetadataCoverRow({
  imageUrl,
  videoUrl,
  videoPosterUrl,
  coverUploadState,
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
        coverUploadState={coverUploadState}
        onUpload={onUpload}
        onClear={onClear}
      />
    </div>
  );
}
