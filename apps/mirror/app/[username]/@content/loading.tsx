import { ArcSphere } from "@/components/animated-geometries/arc-sphere";

export default function ContentLoading() {
  return (
    <div
      role="status"
      aria-label="Loading content"
      data-testid="content-loading"
      className="flex h-full items-center justify-center bg-background pb-20"
    >
      <ArcSphere />
    </div>
  );
}
