"use client";

export type ActiveCoverPreview =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; posterUrl: string | null }
  | null;

export function activeCoverPreviewFromProps(
  imageUrl: string | null,
  videoUrl: string | null,
  videoPosterUrl: string | null,
): ActiveCoverPreview {
  if (videoUrl) return { kind: "video", url: videoUrl, posterUrl: videoPosterUrl };
  if (imageUrl) return { kind: "image", url: imageUrl };
  return null;
}

export function activeCoverPreviewFromFile(
  file: File,
  url: string,
): Exclude<ActiveCoverPreview, null> {
  if (file.type.startsWith("video/")) {
    return { kind: "video", url, posterUrl: null };
  }
  return { kind: "image", url };
}

interface CoverVideoPreviewProps {
  url: string;
  posterUrl: string | null;
}

export function CoverVideoPreview({ url, posterUrl }: CoverVideoPreviewProps) {
  return (
    <video
      data-testid="article-cover-video-preview"
      src={url}
      poster={posterUrl ?? undefined}
      preload="metadata"
      autoPlay
      loop
      muted
      playsInline
      className="block h-auto w-full object-contain"
    />
  );
}
