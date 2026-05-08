"use client";

import { CoverImagePicker } from "./cover-image-picker";

export interface ArticleMetadataCoverRowProps {
  url: string | null;
  onUpload: (file: File) => Promise<{
    storageId: string;
    thumbhash: string;
    url: string;
  }>;
  onClear: () => void;
}

export function ArticleMetadataCoverRow({
  url,
  onUpload,
  onClear,
}: ArticleMetadataCoverRowProps) {
  return (
    <div className="flex gap-1 items-start mb-1">
      <span className="text-[13px] text-muted-foreground w-30 pt-1 font-medium">
        Cover Image
      </span>
      <CoverImagePicker url={url} onUpload={onUpload} onClear={onClear} />
    </div>
  );
}
