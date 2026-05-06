import { ArcSphere } from "@/components/animated-geometries/arc-sphere";

export function PostDetailLoading() {
  return (
    <div
      role="status"
      aria-label="Loading article"
      data-testid="article-detail-loading"
      className="flex items-center justify-center bg-background h-full pb-20"
    >
      <ArcSphere />
    </div>
  );
}
