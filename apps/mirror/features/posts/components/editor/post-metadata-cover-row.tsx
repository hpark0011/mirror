"use client";

import { PostCoverPicker } from "./post-cover-picker";
import { type CoverUploadState } from "../../hooks/use-post-cover-video-upload";

export interface PostMetadataCoverRowProps {
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  coverUploadState: CoverUploadState;
  onUpload: (file: File) => Promise<{ kind: "image" | "video" }>;
  onClear: () => void;
}

export function PostMetadataCoverRow({
  imageUrl,
  videoUrl,
  videoPosterUrl,
  coverUploadState,
  onUpload,
  onClear,
}: PostMetadataCoverRowProps) {
  return (
    <div className="flex gap-1 items-start mb-1">
      <span className="text-[13px] text-muted-foreground w-30 pt-1 font-medium">
        Cover
      </span>
      <PostCoverPicker
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
